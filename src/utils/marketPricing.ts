// Suggested listing prices for the P2P market. Values were fit against real
// prod sales (2026-06-24..2026-07-07, 42 non-admin transactions): base by
// level + linear bonus per sum of upgrade levels + drone-type multiplier.
// A single midpoint is returned per currency — the UI shows it as a hint
// rather than a hard rule, so sellers stay in control.

import type { DroneType, DroneLevel } from '../store/gameStore'

const DRONE_BASE = {
  gold: { 1: 20,  2: 100, 3: 300 },
  ton:  { 1: 0.05, 2: 0.10, 3: 0.20 },
} as const

// scout / combat / stealth = 1 / 2 / 3 in store enum.
// Combat and stealth are gated behind purchase — rarer supply → higher floor.
const DRONE_TYPE_MULT: Record<DroneType, number> = { 1: 1.0, 2: 1.3, 3: 1.6 }

const DRONE_UPG_BONUS = { gold: 30, ton: 0.05 } as const

const TURRET_BASE = {
  gold: { 1: 50,  2: 200, 3: 500 },
  ton:  { 1: 0.05, 2: 0.20, 3: 0.50 },
} as const

const TURRET_UPG_BONUS = { gold: 40, ton: 0.10 } as const

// If the game ever adds L4+, we don't want the suggestion to break or read
// as NaN. Clamp to L3 pricing and add a soft bonus of +50% per extra level
// so a hypothetical L4 unit doesn't get priced identically to L3. This is a
// placeholder — the seller can (and should) override the value manually.
const MAX_KNOWN_LEVEL = 3
const OVER_LEVEL_BONUS_PER_STEP = 0.5   // +50% per level above 3

function clampLevel<L extends 1 | 2 | 3>(lv: number): { level: L; overMult: number } {
  if (lv <= MAX_KNOWN_LEVEL) return { level: (lv as L), overMult: 1 }
  const steps = lv - MAX_KNOWN_LEVEL
  return { level: MAX_KNOWN_LEVEL as L, overMult: 1 + steps * OVER_LEVEL_BONUS_PER_STEP }
}

export interface DronePricingInput {
  type: 'drone'
  level: DroneLevel
  droneType: DroneType
  upgradeLevelSum: number    // Σ level across all installed upgrades
}

export interface TurretPricingInput {
  type: 'turret'
  level: 1 | 2 | 3
  upgradeLevelSum: number
}

export type PricingInput = DronePricingInput | TurretPricingInput

export interface PricingSuggestion {
  gold: number
  ton:  number
}

/**
 * Suggest a fair listing price for a unit. Returns both currencies at once —
 * caller decides which one to show based on the selected tab.
 *
 * Numbers are rounded to keep the hint readable: gold to the nearest 10,
 * TON to 4 decimal places (matching backend precision).
 */
export function suggestPrice(input: PricingInput): PricingSuggestion {
  if (input.type === 'drone') {
    const { level, overMult } = clampLevel<DroneLevel>(input.level)
    const typeMult = DRONE_TYPE_MULT[input.droneType] ?? 1
    const gold = DRONE_BASE.gold[level] * typeMult * overMult + input.upgradeLevelSum * DRONE_UPG_BONUS.gold
    const ton  = DRONE_BASE.ton[level]  * typeMult * overMult + input.upgradeLevelSum * DRONE_UPG_BONUS.ton
    return { gold: Math.round(gold / 10) * 10, ton: +ton.toFixed(4) }
  }
  const { level, overMult } = clampLevel<1 | 2 | 3>(input.level)
  const gold = TURRET_BASE.gold[level] * overMult + input.upgradeLevelSum * TURRET_UPG_BONUS.gold
  const ton  = TURRET_BASE.ton[level]  * overMult + input.upgradeLevelSum * TURRET_UPG_BONUS.ton
  return { gold: Math.round(gold / 10) * 10, ton: +ton.toFixed(4) }
}

export function sumUpgradeLevels(map: Record<string, number> | undefined): number {
  if (!map) return 0
  let s = 0
  for (const k in map) s += map[k] ?? 0
  return s
}
