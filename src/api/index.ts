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
  ApiPurchaseLog,
  DroneType,
  TurretUpgradeType,
  UnitType,
  UnitPosition,
} from './types'

// ── User ───────────────────────────────────────────────────────────────────

export function getMe(): Promise<ApiUser> {
  return apiFetch('/api/user/me')
}

export function updateUserLanguage(language: 'ru' | 'en'): Promise<{ language: string }> {
  return apiFetch('/api/user/language', {
    method: 'PATCH',
    body:   JSON.stringify({ language }),
  })
}

export function updateUserNotifications(enabled: boolean): Promise<{ allow_notification: boolean }> {
  return apiFetch('/api/user/notifications', {
    method: 'PATCH',
    body:   JSON.stringify({ enabled }),
  })
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

export function getIncomingRaids(): Promise<ApiRaid[]> {
  return apiFetch('/api/raids/incoming')
}

// ── Equipment upgrades ─────────────────────────────────────────────────────

export function buyDroneEquipment(droneId: number, upgradeKey: string): Promise<ApiTurretUpgrade> {
  return apiFetch(`/api/drones/${droneId}/equipment`, {
    method: 'POST',
    body:   JSON.stringify({ upgrade_key: upgradeKey }),
  })
}

export function buyTurretEquipment(turretId: number, upgradeKey: string): Promise<ApiTurretUpgrade> {
  return apiFetch(`/api/turrets/${turretId}/equipment`, {
    method: 'POST',
    body:   JSON.stringify({ upgrade_key: upgradeKey }),
  })
}

export function getPurchaseHistory(): Promise<ApiPurchaseLog[]> {
  return apiFetch('/api/purchases')
}

// ── Stars shop ─────────────────────────────────────────────────────────────

export function getShopProducts(): Promise<import('./types').ApiProduct[]> {
  return apiFetch('/api/shop/products')
}

export function buyProduct(productId: number): Promise<{ invoice_url: string }> {
  return apiFetch(`/api/shop/products/${productId}/buy`, { method: 'POST' })
}

export function getWalletRate(): Promise<{ stars_per_ton: number; ton_to_usd: number; source: string }> {
  return apiFetch('/api/wallet/rate')
}

export function getWalletInvoice(): Promise<import('./types').ApiWalletInvoice> {
  return apiFetch('/api/wallet/invoice')
}

export function connectWallet(walletAddress: string): Promise<{ ok: boolean; wallet_address: string }> {
  return apiFetch('/api/wallet/address', {
    method: 'PATCH',
    body: JSON.stringify({ wallet_address: walletAddress }),
  })
}

export function disconnectWallet(): Promise<{ ok: boolean }> {
  return apiFetch('/api/wallet/address', { method: 'DELETE' })
}

export function getReferralLink(): Promise<{ link: string }> {
  return apiFetch('/api/referral/link')
}

export interface ReferralStats {
  total: number
  by_level: { level: number; count: number }[]
  recent: { level: number; username: string; first_name: string; last_name: string; created_at: string }[]
}

export function getReferralStats(): Promise<ReferralStats> {
  return apiFetch('/api/referral/stats')
}

export function prepareReferralMessage(): Promise<{ id: string; expiration_date: number }> {
  return apiFetch('/api/referral/prepare', { method: 'POST' })
}

export function buyListingWithStars(listingId: number): Promise<{ invoice_url: string; stars_amount: number; ton_price: number }> {
  return apiFetch(`/api/market/${listingId}/buy-stars`, { method: 'POST' })
}

// ── Market ─────────────────────────────────────────────────────────────────

export interface MarketQueryParams {
  unit_type?: UnitType
  sort?:      "newest" | "price_asc" | "price_desc"
  currency?:  "gold" | "ton"
  page?:      number
}

export function getMarket(params: MarketQueryParams = {}): Promise<ApiMarketListing[]> {
  const qs = new URLSearchParams()
  if (params.unit_type) qs.set('unit_type', params.unit_type)
  if (params.currency) qs.set("currency", params.currency)
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

export function reserveListing(id: number): Promise<{ reserved_until: number; reserved_by: number }> {
  return apiFetch(`/api/market/${id}/reserve`, { method: 'POST' })
}

export function buyListing(id: number): Promise<{ ok: boolean }> {
  return apiFetch(`/api/market/${id}/buy`, { method: 'POST' })
}

export function createListing(unitType: 'drone' | 'turret', unitId: number, price: number, currency: 'gold' | 'ton'): Promise<ApiMarketListing> {
  return apiFetch('/api/market', {
    method: 'POST',
    body:   JSON.stringify({ unit_type: unitType, unit_id: unitId, price, currency }),
  })
}

export function getMarketHistory(page = 0): Promise<import('./types').ApiMarketHistoryResponse> {
  return apiFetch(`/api/market/history?page=${page}`)
}

export function cancelListing(id: number): Promise<{ ok: boolean }> {
  return apiFetch(`/api/market/${id}`, { method: 'DELETE' })
}

// ── Leaderboard ────────────────────────────────────────────────────────────

export function getLeaderboard(limit = 50): Promise<ApiLeaderboardEntry[]> {
  return apiFetch(`/api/leaderboard?limit=${limit}`)
}
