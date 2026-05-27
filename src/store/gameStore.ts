import { create } from 'zustand'

export type DroneLevel = 1 | 2 | 3

export interface Drone {
  id: string
  level: DroneLevel
  incomePerHour: number
  isBroken: boolean
}

export type Screen = 'farm' | 'shop' | 'raids' | 'profile'

interface GameState {
  balance: number
  energy: number
  maxEnergy: number
  drones: Drone[]
  activeScreen: Screen

  tap: () => void
  repairDrone: (id: string) => void
  setScreen: (screen: Screen) => void
  addBalance: (amount: number) => void
  tickPassiveIncome: () => void
}

const INITIAL_DRONES: Drone[] = [
  { id: 'drone-1', level: 1, incomePerHour: 10, isBroken: false },
]

export const useGameStore = create<GameState>((set, get) => ({
  balance: 0,
  energy: 3,
  maxEnergy: 10,
  drones: INITIAL_DRONES,
  activeScreen: 'farm',

  tap: () => {
    const { energy, balance } = get()
    if (energy <= 0) return
    set({ balance: balance + 0.1, energy: energy - 1 })
  },

  repairDrone: (id) => {
    set((s) => ({
      drones: s.drones.map((d) => d.id === id ? { ...d, isBroken: false } : d),
    }))
  },

  setScreen: (screen) => set({ activeScreen: screen }),

  addBalance: (amount) => set((s) => ({ balance: s.balance + amount })),

  tickPassiveIncome: () => {
    const { drones, balance } = get()
    const income = drones
      .filter((d) => !d.isBroken)
      .reduce((sum, d) => sum + d.incomePerHour / 3600, 0)
    set({ balance: balance + income })
  },
}))
