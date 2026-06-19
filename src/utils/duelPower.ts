import type { Drone, UnitUpgrades } from '../store/gameStore'

// Points per upgrade type per level
const UPGRADE_POWER: Record<string, number> = {
  armor:   50,
  cargo:   30,
  energy:  25,
  ai:      40,
  stealth: 20,
}

/** Power for a single drone including its upgrades. */
export function dronePower(drone: Drone, upgrades: Record<string, number>): number {
  const base = drone.level * 100
  return base + Object.entries(upgrades).reduce(
    (sum, [key, lvl]) => sum + (UPGRADE_POWER[key] ?? 0) * lvl, 0,
  )
}

/** Total power of all (non-broken) player drones. */
export function totalPower(drones: Drone[], unitUpgrades: UnitUpgrades): number {
  return drones
    .filter((d) => !d.isBroken)
    .reduce((sum, d) => sum + dronePower(d, unitUpgrades[d.id] ?? {}), 0)
}

/** Descriptive tier label from power value. */
export function powerTier(power: number): { label: string; color: string } {
  if (power >= 900) return { label: 'ELITE',   color: '#f59e0b' }
  if (power >= 600) return { label: 'ADVANCED', color: '#8b5cf6' }
  if (power >= 350) return { label: 'SKILLED',  color: '#06b6d4' }
  if (power >= 150) return { label: 'ROOKIE',   color: '#22c55e' }
  return              { label: 'NOVICE',   color: '#64748b' }
}
