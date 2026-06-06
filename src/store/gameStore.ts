import { create } from 'zustand'
import * as api from '../api'
import type { ApiDrone, ApiTurret, ApiUser } from '../api/types'

// ── Constants (used by UI screens and Phaser scenes) ──────────────────────

export interface DroneUpgrade {
  level:        DroneLevel
  name:         string
  description:  string
  price:        number
  tapBonus:     number
}

export const DRONE_UPGRADES: DroneUpgrade[] = [
  { level: 1, name: 'Базовый дрон',  description: 'Стандартный фермер',        price: 0,    tapBonus: 0.1 },
  { level: 2, name: 'Турбо-дрон',    description: '+300% доход, +0.2 за клик', price: 500,  tapBonus: 0.3 },
  { level: 3, name: 'Нано-дрон',     description: '+900% доход, +0.5 за клик', price: 2000, tapBonus: 0.5 },
]

export const REPAIR_COSTS: Record<DroneLevel, number> = { 1: 50, 2: 150, 3: 400 }

// ── Local types ────────────────────────────────────────────────────────────

export type DroneLevel = 1 | 2 | 3
export type DroneType  = 1 | 2 | 3   // 1=scout, 2=combat, 3=stealth

export interface Drone {
  id: string
  level: DroneLevel
  droneType: DroneType
  incomePerSec: number   // income_rate from API (coins/second)
  isBroken: boolean
  positionX?: number
  positionY?: number
}

export interface Turret {
  id: string
  level: 1 | 2 | 3
  positionX?: number
  positionY?: number
}

export interface RaidLogEntry {
  id: string
  targetName: string
  won: boolean
  amount: number
  timestamp: number
}

export interface RaidResult {
  won: boolean
  amount: number
  targetName: string
}

export type Screen = 'farm' | 'shop' | 'raids' | 'profile' | 'market' | 'equipment' | 'unit-detail'

export type UnitUpgrades = Record<string, Record<string, number>>

// ── API → local mappers ────────────────────────────────────────────────────

const DRONE_TYPE_MAP: Record<string, DroneType> = {
  scout: 1, combat: 2, stealth: 3,
}

export function mapDrone(d: ApiDrone): Drone {
  return {
    id:          String(d.id),
    level:       (d.level as DroneLevel) ?? 1,
    droneType:   DRONE_TYPE_MAP[d.drone_type] ?? 1,
    incomePerSec: d.income_rate,
    isBroken:    d.is_broken,
    positionX:   d.position_x,
    positionY:   d.position_y,
  }
}

export function mapTurret(t: ApiTurret): Turret {
  return {
    id:        String(t.id),
    level:     (t.level as 1 | 2 | 3) ?? 1,
    positionX: t.position_x,
    positionY: t.position_y,
  }
}

// ── State interface ────────────────────────────────────────────────────────

interface GameState {
  // Data
  balance:        number
  energy:         number
  maxEnergy:      number
  energyProgress: number
  drones:         Drone[]
  turrets:        Turret[]
  raidLog:        RaidLogEntry[]
  lastRaidResult: RaidResult | null
  unitUpgrades:   UnitUpgrades

  // UI
  activeScreen:   Screen
  selectedUnitId: string | null
  soundEnabled:   boolean
  isLoaded:       boolean
  loadError:      string | null

  // Actions — data
  loadGameState:      () => Promise<void>
  tap:                () => void           // FarmScene tap mechanic
  buyDrone:           (droneType?: string) => Promise<boolean>
  upgradeDrone:       (droneId: string) => Promise<boolean>
  repairDrone:        (droneId: string) => Promise<boolean>
  buyTurret:          (level?: number) => Promise<boolean>
  executeRaid:        (defenderId: number) => Promise<RaidResult | null>
  purchaseUnitUpgrade:(unitId: string, upgradeId: string, cost: number) => boolean
  syncPositions:      () => void
  clearRaidResult:    () => void
  addBalance:         (amount: number) => void   // for WebSocket income push

  // Actions — UI
  setScreen:     (screen: Screen) => void
  toggleSound:   () => void
  selectUnit:    (unitId: string | null) => void

  // Game loop (called from App.tsx every second)
  tickEnergyRegen: () => void
}

// ── Store ──────────────────────────────────────────────────────────────────

let _energyAcc = 0

export const useGameStore = create<GameState>((set, get) => ({
  balance:        0,
  energy:         100,
  maxEnergy:      100,
  energyProgress: 0,
  drones:         [],
  turrets:        [],
  raidLog:        [],
  lastRaidResult: null,
  unitUpgrades:   {},
  activeScreen:   'farm',
  selectedUnitId: null,
  soundEnabled:   true,
  isLoaded:       false,
  loadError:      null,

  // ── Tap mechanic (FarmScene) ───────────────────────────────────────────
  tap: () => {
    const { energy, balance, drones } = get()
    if (energy <= 0) return
    const maxLevel = Math.max(1, ...drones.map((d) => d.level)) as DroneLevel
    const bonus = DRONE_UPGRADES[maxLevel - 1]?.tapBonus ?? 0.1
    set({ balance: balance + bonus, energy: energy - 1 })
  },

  // ── Load all game state from API ───────────────────────────────────────

  loadGameState: async () => {
    try {
      const [user, drones, turrets] = await Promise.all([
        api.getMe(),
        api.getDrones(),
        api.getTurrets(),
      ])
      set({
        balance:   Number(user.balance),
        energy:    user.energy,
        maxEnergy: user.max_energy,
        drones:    drones.map(mapDrone),
        turrets:   turrets.map(mapTurret),
        isLoaded:  true,
        loadError: null,
      })
    } catch (err) {
      set({ loadError: (err as Error).message, isLoaded: true })
    }
  },

  // ── Drones ─────────────────────────────────────────────────────────────

  buyDrone: async (droneType = 'scout') => {
    try {
      const drone = await api.buyDrone(droneType)
      set((s) => ({
        balance: s.balance - 100, // optimistic, real value refreshed on next load
        drones:  [...s.drones, mapDrone(drone)],
      }))
      // Refresh balance from server
      const user = await api.getMe()
      set({ balance: Number(user.balance) })
      return true
    } catch {
      return false
    }
  },

  upgradeDrone: async (droneId) => {
    try {
      const upgraded = await api.upgradeDrone(Number(droneId))
      set((s) => ({
        drones: s.drones.map((d) => d.id === droneId ? mapDrone(upgraded) : d),
      }))
      const user = await api.getMe()
      set({ balance: Number(user.balance) })
      return true
    } catch {
      return false
    }
  },

  repairDrone: async (droneId) => {
    try {
      await api.repairDrone(Number(droneId))
      set((s) => ({
        drones: s.drones.map((d) =>
          d.id === droneId ? { ...d, isBroken: false } : d
        ),
      }))
      const user = await api.getMe()
      set({ balance: Number(user.balance) })
      return true
    } catch {
      return false
    }
  },

  // ── Turrets ────────────────────────────────────────────────────────────

  buyTurret: async (level = 1) => {
    try {
      const turret = await api.buyTurret(level)
      set((s) => ({
        turrets: [...s.turrets, mapTurret(turret)],
      }))
      const user = await api.getMe()
      set({ balance: Number(user.balance) })
      return true
    } catch {
      return false
    }
  },

  // ── Raids ──────────────────────────────────────────────────────────────

  executeRaid: async (defenderId) => {
    try {
      const raid = await api.startRaid(defenderId)
      const won    = raid.result === 'victory'
      const amount = Number(raid.coins_stolen)

      const entry: RaidLogEntry = {
        id:         String(raid.id),
        targetName: `Player #${defenderId}`,
        won,
        amount,
        timestamp:  Date.now(),
      }
      const result: RaidResult = { won, amount, targetName: entry.targetName }

      set((s) => ({
        raidLog:       [entry, ...s.raidLog].slice(0, 20),
        lastRaidResult: result,
      }))

      // Refresh balance and drone health after raid
      const [user, drones] = await Promise.all([api.getMe(), api.getDrones()])
      set({ balance: Number(user.balance), drones: drones.map(mapDrone) })

      return result
    } catch {
      return null
    }
  },

  // ── Unit upgrades (local — cosmetic/client-side) ───────────────────────

  purchaseUnitUpgrade: (unitId, upgradeId, cost) => {
    const { balance, unitUpgrades } = get()
    if (balance < cost) return false
    const current = unitUpgrades[unitId]?.[upgradeId] ?? 0
    if (current >= 3) return false
    set((s) => ({
      balance:      s.balance - cost,
      unitUpgrades: {
        ...s.unitUpgrades,
        [unitId]: { ...(s.unitUpgrades[unitId] ?? {}), [upgradeId]: current + 1 },
      },
    }))
    return true
  },

  // ── Position sync ──────────────────────────────────────────────────────

  syncPositions: () => {
    const { drones, turrets } = get()
    api.syncPositions(
      drones.map((d) => ({ id: Number(d.id), position_x: d.positionX ?? 0, position_y: d.positionY ?? 0 })),
      turrets.map((t) => ({ id: Number(t.id), position_x: t.positionX ?? 0, position_y: t.positionY ?? 0 })),
    ).catch(() => {/* silent — positions are cosmetic */})
  },

  // ── WebSocket income push ──────────────────────────────────────────────
  addBalance: (amount) => set((s) => ({ balance: s.balance + amount })),

  // ── Energy regen (client-side smooth animation) ───────────────────────
  tickEnergyRegen: () => {
    const { energy, maxEnergy } = get()
    if (energy >= maxEnergy) {
      if (_energyAcc !== 0) { _energyAcc = 0; set({ energyProgress: 0 }) }
      return
    }
    _energyAcc += 1 / 30
    if (_energyAcc >= 1) {
      _energyAcc -= 1
      set({ energy: Math.min(maxEnergy, energy + 1), energyProgress: _energyAcc })
    } else {
      set({ energyProgress: _energyAcc })
    }
  },

  // ── UI ─────────────────────────────────────────────────────────────────
  clearRaidResult: () => set({ lastRaidResult: null }),
  setScreen:       (screen) => set({ activeScreen: screen }),
  toggleSound:     () => set((s) => ({ soundEnabled: !s.soundEnabled })),
  selectUnit:      (unitId) => set({ selectedUnitId: unitId }),
}))
