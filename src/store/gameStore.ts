import { create } from 'zustand'
import * as api from '../api'
import type { ApiDrone, ApiTurret, ApiUser, ApiDuelPlayer, ApiDuelChallenge, DuelCurrency } from '../api/types'

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

export interface IncomingRaidEntry {
  id:           string
  attackerName: string
  attackerId:   number
  won:          boolean   // true = defender won (attacker defeated)
  amount:       number    // coins stolen from me (0 if defended)
  timestamp:    number
}

export type Screen = 'farm' | 'shop' | 'raids' | 'profile' | 'market' | 'market-history' | 'equipment' | 'unit-detail' | 'purchases' | 'topup' | 'contest' | 'duel' | 'duel-battle' | 'duel-history'

export type UnitUpgrades = Record<string, Record<string, number>>

// ── Duel types ────────────────────────────────────────────────────────────────

export interface DuelConfig {
  duelId:           number
  playerDroneType:  1 | 2 | 3
  playerUpgrades:   Record<string, number>
  opponentId:       number
  opponentName:     string
  opponentType:     1 | 2 | 3
  opponentUpgrades: Record<string, number>
  betAmount:        number
  currency:         DuelCurrency
}

// ── API → local mappers ────────────────────────────────────────────────────

// Maps backend DroneUpgradeType → frontend upgrade template id
const DRONE_UPGRADE_TYPE_MAP: Record<string, string> = {
  cargo_bay: 'cargo', stealth_module: 'stealth', energy_cell: 'energy',
  ai_navigation: 'ai', armor: 'armor',
}
// Maps backend TurretUpgradeType → frontend upgrade template id
const TURRET_UPGRADE_TYPE_MAP: Record<string, string> = {
  scope: 'targeting', firepower: 'firepower', range: 'range',
  reload: 'reload', shield: 'shield',
}

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
    // backend returns turret_level, not level
    level:     ((t.turret_level ?? t.level) as 1 | 2 | 3) ?? 1,
    positionX: t.position_x,
    positionY: t.position_y,
  }
}

// ── State interface ────────────────────────────────────────────────────────

interface GameState {
  // Data
  balance:          number   // display value — updated every second by tickBalance
  balanceBase:      number   // last committed balance from server
  balanceUpdatedAt: number   // ms timestamp of last server commit
  incomeRateTotal:  number   // coins/second — sum of active drone income_rate
  tonBalance:       number   // real TON crypto balance
  tonWallet:        string   // connected TON wallet address (empty = not connected)
  // Telegram user profile
  userId:           number   // PostgreSQL users.id (needed to determine duel winner)
  telegramId:       number
  firstName:        string
  lastName:         string
  username:         string
  energy:         number
  maxEnergy:      number
  energyProgress: number
  drones:         Drone[]
  turrets:        Turret[]
  raidLog:                 RaidLogEntry[]
  lastRaidResult:          RaidResult | null
  incomingRaidLog:         IncomingRaidEntry[]
  incomingRaidNotification: IncomingRaidEntry | null
  unitUpgrades:   UnitUpgrades
  language:            string   // current UI language (ru/en), synced from API
  allowNotification:   boolean  // synced from API allow_notification
  allowDuel:           boolean  // synced from API allow_duel

  // UI
  activeScreen:   Screen
  selectedUnitId: string | null
  soundEnabled:   boolean
  isLoaded:       boolean
  loadError:      string | null

  // Actions — data
  loadGameState:      () => Promise<void>
  tickBalance:        () => void           // called every second from App.tsx
  updateLanguage:       (lang: 'ru' | 'en') => Promise<void>
  updateNotifications:  (enabled: boolean) => Promise<void>
  updateDuelSettings:   (enabled: boolean) => Promise<void>
  tap:                () => void           // FarmScene tap mechanic
  buyDrone:           (droneType?: import('../api/types').DroneType) => Promise<boolean>
  upgradeDrone:       (droneId: string) => Promise<boolean>
  repairDrone:        (droneId: string) => Promise<boolean>
  buyTurret:          (level?: 1 | 2 | 3) => Promise<boolean>
  executeRaid:        (defenderId: number) => Promise<RaidResult | null>
  purchaseUnitUpgrade:(unitId: string, upgradeId: string, cost: number) => Promise<boolean>
  syncPositions:      () => void
  clearRaidResult:           () => void
  addIncomingRaid:           (entry: IncomingRaidEntry) => void
  clearIncomingNotification: () => void
  addBalance:                (amount: number) => void
  setTonBalance:             (amount: number) => void
  tonDepositToast:           { amount: number } | null
  setTonDepositToast:        (n: { amount: number } | null) => void
  marketSoldToast:           { price: number; currency: string; unitType: string } | null
  setMarketSoldToast:        (n: { price: number; currency: string; unitType: string } | null) => void
  setTonWallet:              (address: string) => void

  // Duel
  pendingDuelChallenge:  ApiDuelChallenge | null
  activeDuelConfig:      DuelConfig | null
  pendingDuelConfig:     DuelConfig | null   // challenger waits here until duel.start WS
  duelWaiting:           { duelId: number; opponentName: string; expiresAt: number } | null
  duelDeclined:          boolean
  setPendingDuelChallenge: (c: ApiDuelChallenge | null) => void
  startDuelWithPlayer:   (player: ApiDuelPlayer, betAmount: number, currency: DuelCurrency) => Promise<void>
  acceptDuelChallenge:   () => Promise<void>
  declineDuelChallenge:  () => void
  activatePendingDuel:   () => void   // called when duel.start WS arrives (challenger side)
  endDuel:               (won: boolean) => void
  clearDuel:             () => void
  clearDuelDeclined:     () => void

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
  balance:          0,
  balanceBase:      0,
  balanceUpdatedAt: 0,
  incomeRateTotal:  0,
  tonBalance:       0,
  tonWallet:        '',
  userId:           0,
  telegramId:       0,
  firstName:        '',
  lastName:         '',
  username:         '',
  energy:           100,
  maxEnergy:      100,
  energyProgress: 0,
  drones:         [],
  turrets:        [],
  raidLog:                  [],
  lastRaidResult:           null,
  incomingRaidLog:          [],
  incomingRaidNotification: null,
  unitUpgrades:        {},
  language:            'ru',
  allowNotification:   true,
  allowDuel:           true,
  activeScreen:        'farm',
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

      // Clear stale duel state: if server says no active duel, wipe frontend cache
      api.getMyActiveDuel().then((res) => {
        if (!res.active) {
          const { activeDuelConfig, duelWaiting } = get()
          if (activeDuelConfig || duelWaiting) {
            set({ activeDuelConfig: null, pendingDuelConfig: null, duelWaiting: null })
          }
        }
      }).catch(() => {/* silent — duel check is best-effort */})
      // The server returns effective balance (base + accrued).
      // We store that as the new base and reset the local timer.
      const balanceBase      = Number(user.balance)
      const balanceUpdatedAt = Date.now()

      // Rebuild unitUpgrades from server data so they survive page refreshes
      const unitUpgrades: UnitUpgrades = {}
      for (const d of drones) {
        if (!d.upgrades?.length) continue
        const map: Record<string, number> = {}
        for (const u of d.upgrades) {
          const key = DRONE_UPGRADE_TYPE_MAP[u.upgrade_type]
          if (key) map[key] = u.level
        }
        if (Object.keys(map).length) unitUpgrades[String(d.id)] = map
      }
      for (const t of turrets) {
        if (!t.upgrades?.length) continue
        const map: Record<string, number> = {}
        for (const u of t.upgrades) {
          const key = TURRET_UPGRADE_TYPE_MAP[u.upgrade_type]
          if (key) map[key] = u.level
        }
        if (Object.keys(map).length) unitUpgrades[String(t.id)] = map
      }

      set({
        balance:          balanceBase,
        balanceBase,
        balanceUpdatedAt,
        incomeRateTotal:  user.income_rate_total ?? 0,
        tonBalance:       Number(user.ton_balance ?? 0),
        tonWallet:        user.ton_wallet ?? '',
        userId:           user.id,
        telegramId:       user.telegram_id,
        firstName:        user.first_name ?? '',
        lastName:         user.last_name  ?? '',
        username:         user.username   ?? '',
        energy:           user.energy,
        maxEnergy:        user.max_energy,
        drones:           drones.map(mapDrone),
        turrets:          turrets.map(mapTurret),
        unitUpgrades,
        language:            user.language ?? 'ru',
        allowNotification:   user.allow_notification ?? true,
        allowDuel:           user.allow_duel ?? true,
        isLoaded:            true,
        loadError:           null,
      })
    } catch (err) {
      set({ loadError: (err as Error).message, isLoaded: true })
    }
  },

  // ── Local balance tick (runs every second, zero network) ──────────────
  tickBalance: () => {
    const { balanceBase, balanceUpdatedAt, incomeRateTotal } = get()
    if (incomeRateTotal <= 0 || balanceUpdatedAt === 0) return
    const elapsed = (Date.now() - balanceUpdatedAt) / 1000
    set({ balance: balanceBase + incomeRateTotal * elapsed })
  },

  // ── Language ──────────────────────────────────────────────────
  updateLanguage: async (lang) => {
    set({ language: lang })
    try { await api.updateUserLanguage(lang) } catch { /* silent */ }
  },

  // ── Notifications opt-in / opt-out ────────────────────────────
  updateNotifications: async (enabled) => {
    set({ allowNotification: enabled })
    try { await api.updateUserNotifications(enabled) } catch { set({ allowNotification: !enabled }) }
  },

  // ── Duel challenges opt-in / opt-out ──────────────────────────
  updateDuelSettings: async (enabled) => {
    set({ allowDuel: enabled })
    try { await api.updateUserDuelSettings(enabled) } catch { set({ allowDuel: !enabled }) }
  },

  // ── Drones ─────────────────────────────────────────────────────────────

  buyDrone: async (droneType: import('../api/types').DroneType = 'scout') => {
    try {
      const drone = await api.buyDrone(droneType)
      set((s) => ({ drones: [...s.drones, mapDrone(drone)] }))
      const user = await api.getMe()
      set({ balance: Number(user.balance), balanceBase: Number(user.balance), balanceUpdatedAt: Date.now() })
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
      set({ balance: Number(user.balance), balanceBase: Number(user.balance), balanceUpdatedAt: Date.now() })
      return true
    } catch {
      return false
    }
  },

  repairDrone: async (droneId) => {
    try {
      await api.repairDrone(Number(droneId))
      set((s) => ({
        drones: s.drones.map((d) => d.id === droneId ? { ...d, isBroken: false } : d),
      }))
      const user = await api.getMe()
      set({ balance: Number(user.balance), balanceBase: Number(user.balance), balanceUpdatedAt: Date.now() })
      return true
    } catch {
      return false
    }
  },

  // ── Turrets ────────────────────────────────────────────────────────────

  buyTurret: async (level: 1 | 2 | 3 = 1) => {
    try {
      const turret = await api.buyTurret(level)
      set((s) => ({ turrets: [...s.turrets, mapTurret(turret)] }))
      const user = await api.getMe()
      set({ balance: Number(user.balance), balanceBase: Number(user.balance), balanceUpdatedAt: Date.now() })
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

  // ── Unit upgrades — persisted via API ─────────────────────────────────

  purchaseUnitUpgrade: async (unitId, upgradeId, cost) => {
    const { drones, turrets, unitUpgrades } = get()
    const current = unitUpgrades[unitId]?.[upgradeId] ?? 0
    if (current >= 3) return false

    const isDrone = drones.some((d) => d.id === unitId)
    try {
      if (isDrone) {
        await api.buyDroneEquipment(Number(unitId), upgradeId)
      } else {
        await api.buyTurretEquipment(Number(unitId), upgradeId)
      }
      // Refresh balance from server (committed in transaction)
      const user = await api.getMe()
      set((s) => ({
        balance:          Number(user.balance),
        balanceBase:      Number(user.balance),
        balanceUpdatedAt: Date.now(),
        unitUpgrades: {
          ...s.unitUpgrades,
          [unitId]: { ...(s.unitUpgrades[unitId] ?? {}), [upgradeId]: current + 1 },
        },
      }))
      return true
    } catch {
      return false
    }
  },

  // ── Position sync ──────────────────────────────────────────────────────

  syncPositions: () => {
    const { drones, turrets } = get()
    api.syncPositions(
      drones.map((d) => ({ id: Number(d.id), position_x: d.positionX ?? 0, position_y: d.positionY ?? 0 })),
      turrets.map((t) => ({ id: Number(t.id), position_x: t.positionX ?? 0, position_y: t.positionY ?? 0 })),
    ).catch(() => {/* silent — positions are cosmetic */})
  },

  // ── Re-sync balance base (called after any server transaction) ───────
  addBalance: (amount) => set((s) => ({
    balance:          s.balance + amount,
    balanceBase:      s.balance + amount,
    balanceUpdatedAt: Date.now(),
  })),
  setTonBalance:      (amount) => set({ tonBalance: amount }),
  tonDepositToast:    null,
  setTonDepositToast: (n) => set({ tonDepositToast: n }),
  marketSoldToast:    null,
  setMarketSoldToast: (n) => set({ marketSoldToast: n }),
  setTonWallet:  (address) => set({ tonWallet: address }),

  // ── Duel ───────────────────────────────────────────────────────────────────

  pendingDuelChallenge: null,
  activeDuelConfig:     null,
  pendingDuelConfig:    null,
  duelWaiting:          null,
  duelDeclined:         false,

  setPendingDuelChallenge: (c) => set({ pendingDuelChallenge: c }),

  // Challenger sends challenge → waits for duel.start WS event
  startDuelWithPlayer: async (player, betAmount, currency) => {
    const { drones, unitUpgrades } = get()
    const bestDrone = [...drones].sort((a, b) => b.level - a.level)[0]
    if (!bestDrone) return

    const duel = await api.sendDuelChallenge(player.id, betAmount, currency)
    const droneUpgrades = unitUpgrades[bestDrone.id] ?? {}

    set({
      duelWaiting: {
        duelId:       duel.id,
        opponentName: player.first_name || player.username,
        expiresAt:    Date.now() + 29_000,
      },
      pendingDuelConfig: {
        duelId:           duel.id,
        playerDroneType:  bestDrone.droneType,
        playerUpgrades:   droneUpgrades,
        opponentId:       player.id,
        opponentName:     player.first_name || player.username,
        opponentType:     1,
        opponentUpgrades: {},
        betAmount,
        currency,
      },
    })
  },

  // Defender accepts → go straight to battle
  acceptDuelChallenge: async () => {
    const { pendingDuelChallenge, drones, unitUpgrades } = get()
    if (!pendingDuelChallenge) return

    await api.acceptDuelChallenge(pendingDuelChallenge.duel_id)

    const bestDrone = [...drones].sort((a, b) => b.level - a.level)[0]
    const droneUpgrades = bestDrone ? (unitUpgrades[bestDrone.id] ?? {}) : {}

    set({
      pendingDuelChallenge: null,
      activeDuelConfig: {
        duelId:           pendingDuelChallenge.duel_id,
        playerDroneType:  bestDrone?.droneType ?? 1,
        playerUpgrades:   droneUpgrades,
        opponentId:       pendingDuelChallenge.challenger_id,
        opponentName:     pendingDuelChallenge.challenger_name,
        opponentType:     1,
        opponentUpgrades: {},
        betAmount:        pendingDuelChallenge.bet_amount,
        currency:         pendingDuelChallenge.currency,
      },
      activeScreen: 'duel-battle',
    })
  },

  declineDuelChallenge: () => {
    const { pendingDuelChallenge } = get()
    if (pendingDuelChallenge) {
      api.declineDuelChallenge(pendingDuelChallenge.duel_id).catch(() => {/* silent */})
    }
    set({ pendingDuelChallenge: null })
  },

  // WS duel.start arrives → challenger activates pending config
  activatePendingDuel: () => {
    const { pendingDuelConfig } = get()
    if (!pendingDuelConfig) return
    set({
      activeDuelConfig:  pendingDuelConfig,
      pendingDuelConfig: null,
      duelWaiting:       null,
      activeScreen:      'duel-battle',
    })
  },

  endDuel: (won) => {
    const { activeDuelConfig, userId } = get()
    if (!activeDuelConfig) return

    const winnerId = won ? userId : activeDuelConfig.opponentId
    // Guard against double-submit (both local detection + WS result)
    api.submitDuelResult(activeDuelConfig.duelId, winnerId)
      .then(() => api.getMe())
      .then((user) => {
        set({
          balance:          Number(user.balance),
          balanceBase:      Number(user.balance),
          balanceUpdatedAt: Date.now(),
          tonBalance:       Number(user.ton_balance ?? 0),
        })
      })
      .catch(() => {
        // 409 = result already submitted by opponent — still refresh balance
        api.getMe().then((user) => {
          set({
            balance:          Number(user.balance),
            balanceBase:      Number(user.balance),
            balanceUpdatedAt: Date.now(),
            tonBalance:       Number(user.ton_balance ?? 0),
          })
        }).catch(() => {/* silent */})
      })
  },

  clearDuel: () => set({ activeDuelConfig: null, pendingDuelConfig: null, duelWaiting: null }),
  clearDuelDeclined: () => set({ duelDeclined: false }),

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
  addIncomingRaid: (entry) => set((s) => ({
    incomingRaidLog:          [entry, ...s.incomingRaidLog].slice(0, 50),
    incomingRaidNotification: entry,
  })),
  clearIncomingNotification: () => set({ incomingRaidNotification: null }),
  setScreen:       (screen) => set({ activeScreen: screen }),
  toggleSound:     () => set((s) => ({ soundEnabled: !s.soundEnabled })),
  selectUnit:      (unitId) => set({ selectedUnitId: unitId }),
}))
