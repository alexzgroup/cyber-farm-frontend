import { apiFetch } from './client'
import type {
  ApiUser,
  ApiUserPublic,
  ApiDrone,
  ApiTurret,
  ApiTurretUpgrade,
  ApiRaid,
  ApiMarketListing,
  ApiLeaderboardEntry,
  DroneType,
  TurretUpgradeType,
  UnitType,
  UnitPosition,
} from './types'

// ── User ───────────────────────────────────────────────────────────────────

export function getMe(): Promise<ApiUser> {
  return apiFetch('/api/user/me')
}

export function syncPositions(
  drones:  UnitPosition[],
  turrets: UnitPosition[],
): Promise<{ ok: boolean }> {
  return apiFetch('/api/user/sync', {
    method: 'POST',
    body:   JSON.stringify({ drones, turrets }),
  })
}

// ── Drones ─────────────────────────────────────────────────────────────────

export function getDrones(): Promise<ApiDrone[]> {
  return apiFetch('/api/drones')
}

export function buyDrone(droneType: DroneType): Promise<ApiDrone> {
  return apiFetch('/api/drones', {
    method: 'POST',
    body:   JSON.stringify({ drone_type: droneType }),
  })
}

export function upgradeDrone(id: number): Promise<ApiDrone> {
  return apiFetch(`/api/drones/${id}/upgrade`, { method: 'PUT' })
}

export function repairDrone(id: number): Promise<{ ok: boolean }> {
  return apiFetch(`/api/drones/${id}/repair`, { method: 'POST' })
}

// ── Turrets ────────────────────────────────────────────────────────────────

export function getTurrets(): Promise<ApiTurret[]> {
  return apiFetch('/api/turrets')
}

export function buyTurret(turretLevel: 1 | 2 | 3): Promise<ApiTurret> {
  return apiFetch('/api/turrets', {
    method: 'POST',
    body:   JSON.stringify({ turret_level: turretLevel }),
  })
}

export function upgradeTurret(
  id:          number,
  upgradeType: TurretUpgradeType,
): Promise<ApiTurretUpgrade> {
  return apiFetch(`/api/turrets/${id}/upgrade`, {
    method: 'PUT',
    body:   JSON.stringify({ upgrade_type: upgradeType }),
  })
}

// ── Raids ──────────────────────────────────────────────────────────────────

export function getRaidTargets(): Promise<ApiUserPublic[]> {
  return apiFetch('/api/raids/targets')
}

export function startRaid(defenderId: number): Promise<ApiRaid> {
  return apiFetch('/api/raids', {
    method: 'POST',
    body:   JSON.stringify({ defender_id: defenderId }),
  })
}

export function getRaidHistory(): Promise<ApiRaid[]> {
  return apiFetch('/api/raids/history')
}

// ── Market ─────────────────────────────────────────────────────────────────

export interface MarketQueryParams {
  unit_type?: UnitType
  sort?:      'newest' | 'price_asc' | 'price_desc'
  page?:      number
}

export function getMarket(params: MarketQueryParams = {}): Promise<ApiMarketListing[]> {
  const qs = new URLSearchParams()
  if (params.unit_type) qs.set('unit_type', params.unit_type)
  if (params.sort)      qs.set('sort',      params.sort)
  if (params.page)      qs.set('page',      String(params.page))
  const query = qs.toString()
  return apiFetch(`/api/market${query ? `?${query}` : ''}`)
}

export function listUnit(
  unitType: UnitType,
  unitId:   number,
  price:    number,
): Promise<ApiMarketListing> {
  return apiFetch('/api/market', {
    method: 'POST',
    body:   JSON.stringify({ unit_type: unitType, unit_id: unitId, price }),
  })
}

export function buyListing(id: number): Promise<{ ok: boolean }> {
  return apiFetch(`/api/market/${id}/buy`, { method: 'POST' })
}

export function cancelListing(id: number): Promise<{ ok: boolean }> {
  return apiFetch(`/api/market/${id}`, { method: 'DELETE' })
}

// ── Leaderboard ────────────────────────────────────────────────────────────

export function getLeaderboard(limit = 50): Promise<ApiLeaderboardEntry[]> {
  return apiFetch(`/api/leaderboard?limit=${limit}`)
}
