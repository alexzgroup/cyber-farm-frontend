import { create } from 'zustand'
import { MOCK_PLAYERS } from '../data/mockPlayers'

export type DroneLevel = 1 | 2 | 3

export interface Drone {
  id: string
  level: DroneLevel
  incomePerHour: number
  isBroken: boolean
}

export interface DroneUpgrade {
  level: DroneLevel
  name: string
  description: string
  price: number
  incomePerHour: number
  tapBonus: number
}

export const DRONE_UPGRADES: DroneUpgrade[] = [
  { level: 1, name: 'Базовый дрон',  description: 'Стандартный фермер',        price: 0,    incomePerHour: 10,  tapBonus: 0.1 },
  { level: 2, name: 'Турбо-дрон',    description: '+300% доход, +0.2 за клик', price: 500,  incomePerHour: 40,  tapBonus: 0.3 },
  { level: 3, name: 'Нано-дрон',     description: '+900% доход, +0.5 за клик', price: 2000, incomePerHour: 100, tapBonus: 0.5 },
]

// Repair cost by drone level
export const REPAIR_COSTS: Record<DroneLevel, number> = { 1: 50, 2: 150, 3: 400 }

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
  attackerLevel: number
}

export type Screen = 'farm' | 'shop' | 'raids' | 'profile'

interface GameState {
  balance: number
  energy: number
  maxEnergy: number
  energyProgress: number   // 0–1, progress to next energy point (for HUD)
  drones: Drone[]
  activeScreen: Screen
  raidLog: RaidLogEntry[]
  lastRaidResult: RaidResult | null

  tap: () => void
  repairDrone: (id: string) => boolean
  upgradeDrone: (droneId: string) => boolean
  buyDrone: () => boolean
  executeRaid: (targetId: string) => RaidResult | null
  clearRaidResult: () => void
  setScreen: (screen: Screen) => void
  addBalance: (amount: number) => void
  tickPassiveIncome: () => void
  tickEnergyRegen: () => void
}

const INITIAL_DRONES: Drone[] = [
  { id: 'drone-1', level: 1, incomePerHour: 10, isBroken: false },
]

// Module-level accumulator — no need to store sub-unit in Zustand state
let _energyAcc = 0
const ENERGY_REGEN_RATE = 1 / 30  // 1 energy per 30 seconds

export const useGameStore = create<GameState>((set, get) => ({
  balance: 0,
  energy: 3,
  maxEnergy: 10,
  energyProgress: 0,
  drones: INITIAL_DRONES,
  activeScreen: 'farm',
  raidLog: [],
  lastRaidResult: null,

  tap: () => {
    const { energy, balance, drones } = get()
    if (energy <= 0) return
    const maxLevel = Math.max(...drones.map((d) => d.level)) as DroneLevel
    const bonus = DRONE_UPGRADES[maxLevel - 1].tapBonus
    set({ balance: balance + bonus, energy: energy - 1 })
  },

  repairDrone: (id) => {
    const { drones, balance } = get()
    const drone = drones.find((d) => d.id === id)
    if (!drone || !drone.isBroken) return false
    const cost = REPAIR_COSTS[drone.level]
    if (balance < cost) return false
    set((s) => ({
      balance: s.balance - cost,
      drones: s.drones.map((d) => d.id === id ? { ...d, isBroken: false } : d),
    }))
    return true
  },

  upgradeDrone: (droneId) => {
    const { balance, drones } = get()
    const drone = drones.find((d) => d.id === droneId)
    if (!drone || drone.level >= 3) return false
    const nextLevel = (drone.level + 1) as DroneLevel
    const upgrade = DRONE_UPGRADES[nextLevel - 1]
    if (balance < upgrade.price) return false
    set((s) => ({
      balance: s.balance - upgrade.price,
      drones: s.drones.map((d) =>
        d.id === droneId
          ? { ...d, level: nextLevel, incomePerHour: upgrade.incomePerHour }
          : d
      ),
    }))
    return true
  },

  buyDrone: () => {
    const { balance, drones } = get()
    const price = 300 + drones.length * 200
    if (balance < price) return false
    set((s) => ({
      balance: s.balance - price,
      drones: [...s.drones, { id: `drone-${Date.now()}`, level: 1, incomePerHour: 10, isBroken: false }],
    }))
    return true
  },

  executeRaid: (targetId) => {
    const { drones } = get()
    const target = MOCK_PLAYERS.find((p) => p.id === targetId)
    if (!target) return null
    const workingDrones = drones.filter((d) => !d.isBroken)
    if (workingDrones.length === 0) return null

    const attackerLevel = Math.max(...workingDrones.map((d) => d.level))
    const winChance = Math.min(0.85, Math.max(0.2, 0.5 + (attackerLevel - target.defenseLevel) * 0.2))
    const won = Math.random() < winChance
    let amount = 0

    if (won) {
      amount = Math.round(target.balance * (0.1 + Math.random() * 0.1))
      set((s) => ({ balance: s.balance + amount }))
    } else {
      const victim = workingDrones[Math.floor(Math.random() * workingDrones.length)]
      set((s) => ({
        drones: s.drones.map((d) => d.id === victim.id ? { ...d, isBroken: true } : d),
      }))
    }

    const entry: RaidLogEntry = { id: `raid-${Date.now()}`, targetName: target.name, won, amount, timestamp: Date.now() }
    const result: RaidResult = { won, amount, targetName: target.name, attackerLevel }
    set((s) => ({ raidLog: [entry, ...s.raidLog].slice(0, 20), lastRaidResult: result }))
    return result
  },

  clearRaidResult: () => set({ lastRaidResult: null }),

  setScreen: (screen) => set({ activeScreen: screen }),

  addBalance: (amount) => set((s) => ({ balance: s.balance + amount })),

  tickPassiveIncome: () => {
    const { drones } = get()
    const income = drones
      .filter((d) => !d.isBroken)
      .reduce((sum, d) => sum + d.incomePerHour / 3600, 0)
    if (income > 0) set((s) => ({ balance: s.balance + income }))
  },

  tickEnergyRegen: () => {
    const { energy, maxEnergy } = get()
    if (energy >= maxEnergy) {
      if (_energyAcc !== 0) { _energyAcc = 0; set({ energyProgress: 0 }) }
      return
    }
    _energyAcc += ENERGY_REGEN_RATE
    if (_energyAcc >= 1) {
      _energyAcc -= 1
      set({ energy: Math.min(maxEnergy, energy + 1), energyProgress: _energyAcc })
    } else {
      set({ energyProgress: _energyAcc })
    }
  },
}))
