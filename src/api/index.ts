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

export function flushTaps(taps: number): Promise<{ balance: number; energy: number; taps_applied: number }> {
  return apiFetch('/api/user/tap', {
    method: 'POST',
    body:   JSON.stringify({ taps }),
  })
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

export function updateUserDuelSettings(enabled: boolean): Promise<{ allow_duel: boolean }> {
  return apiFetch('/api/user/duel', {
    method: 'PATCH',
    body:   JSON.stringify({ enabled }),
  })
}

// Distress offer — one-shot triggered -50% Starter (12⭐/750g).
export function dismissDistressOffer(): Promise<{ distress_dismissed_at: string }> {
  return apiFetch('/api/user/distress/dismiss', { method: 'POST' })
}

export function buyDistressPack(): Promise<{ invoice_url: string; stars: number; gold: number }> {
  return apiFetch('/api/distress/buy', { method: 'POST' })
}

// Rescue Bundle — 30⭐ post-Starter upsell (gold + shield days + free drone).
export function buyRescuePack(): Promise<{ invoice_url: string; stars: number; gold: number; shield_days: number }> {
  return apiFetch('/api/rescue/buy', { method: 'POST' })
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

export function getRaidTargets(search?: string): Promise<ApiUserPublic[]> {
  const qs = search && search.trim().length >= 2 ? `?search=${encodeURIComponent(search.trim())}` : ''
  return apiFetch(`/api/raids/targets${qs}`)
}

export function startRaid(
  defenderId: number,
  captcha?: { id: string; answer: string },
): Promise<ApiRaid> {
  return apiFetch('/api/raids', {
    method: 'POST',
    body:   JSON.stringify({
      defender_id: defenderId,
      ...(captcha ? { captcha_id: captcha.id, captcha_answer: captcha.answer } : {}),
    }),
  })
}

export function getCaptchaChallenge(): Promise<{ id: string; question: string; ttl: number }> {
  return apiFetch('/api/captcha/challenge')
}

export function getRaidHistory(): Promise<ApiRaid[]> {
  return apiFetch('/api/raids/history')
}

export function getIncomingRaids(): Promise<ApiRaid[]> {
  return apiFetch('/api/raids/incoming')
}

export function getRaidStats(): Promise<import('./types').RaidStats> {
  return apiFetch('/api/raids/stats')
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

// ── Raid shield ────────────────────────────────────────────────────────────

export function getShieldPrice(): Promise<{ stars_per_day: number; shielded_until?: number }> {
  return apiFetch('/api/shield/price')
}

export function buyShield(days: number): Promise<{
  invoice_url: string; stars: number; days: number; stars_per_day: number
}> {
  return apiFetch('/api/shield/buy', { method: 'POST', body: JSON.stringify({ days }) })
}

export function getWalletRate(): Promise<{ stars_per_ton: number; ton_to_usd: number; source: string }> {
  return apiFetch('/api/wallet/rate')
}

export function getWalletInvoice(): Promise<import('./types').ApiWalletInvoice> {
  return apiFetch('/api/wallet/invoice')
}

export function getWithdrawals(): Promise<import('./types').ApiWithdrawalsResponse> {
  return apiFetch('/api/wallet/withdrawals')
}

export function requestWithdrawal(amount: number): Promise<{
  id: number; amount: number; fee: number; payout: number; commission: number; to_wallet: string; status: string
}> {
  return apiFetch('/api/wallet/withdraw', { method: 'POST', body: JSON.stringify({ amount }) })
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

export function getReferralStats(): Promise<import('./types').ReferralStats> {
  return apiFetch('/api/referral/stats')
}

export function getReferralList(page = 1): Promise<import('./types').ReferralList> {
  return apiFetch(`/api/referral/list?page=${page}`)
}

export function prepareReferralMessage(): Promise<{ id: string; expiration_date: number }> {
  return apiFetch('/api/referral/prepare', { method: 'POST' })
}

export function getReferralRates(): Promise<import('./types').ReferralRates> {
  return apiFetch('/api/referral/rates')
}

export function getAdsgramStatus(): Promise<{ next_at: number; cooldown_sec: number; reward: number }> {
  return apiFetch('/api/adsgram/status')
}

export function getDailyBonusStatus(): Promise<import('./types').DailyBonusStatus> {
  return apiFetch('/api/daily-bonus/status')
}

export function claimDailyBonus(): Promise<import('./types').DailyBonusClaim> {
  return apiFetch('/api/daily-bonus/claim', { method: 'POST' })
}

export function buyListingWithStars(listingId: number): Promise<{
  invoice_url: string
  stars: number
  reserved_until: number
  seller_receives: number
}> {
  return apiFetch(`/api/market/${listingId}/buy-stars`, { method: 'POST' })
}

export interface MarketFees {
  contest_rate:        number
  platform_commission: number
  seller_rate:         number
  min_gold:            number
  max_gold:            number
  min_ton:             number
  max_ton:             number
}

export function getMarketFees(): Promise<MarketFees> {
  return apiFetch('/api/market/fees')
}

// ── Market ─────────────────────────────────────────────────────────────────

export interface MarketQueryParams {
  unit_type?: UnitType
  sort?:      "newest" | "price_asc" | "price_desc"
  currency?:  "gold" | "ton"
  page?:      number
  mine?:      boolean
}

export function getMarket(params: MarketQueryParams = {}): Promise<ApiMarketListing[]> {
  const qs = new URLSearchParams()
  if (params.unit_type) qs.set('unit_type', params.unit_type)
  if (params.currency)  qs.set('currency',  params.currency)
  if (params.sort)      qs.set('sort',      params.sort)
  if (params.page)      qs.set('page',      String(params.page))
  if (params.mine)      qs.set('mine',      'true')
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

export function getContestCurrent(): Promise<import('./types').ContestCurrent> {
  return apiFetch('/api/contest/current')
}

export function getContestLast(): Promise<import('./types').ContestLast> {
  return apiFetch('/api/contest/last')
}

export function getMarketHistory(page = 0): Promise<import('./types').ApiMarketHistoryResponse> {
  return apiFetch(`/api/market/history?page=${page}`)
}

export function cancelListing(id: number): Promise<{ ok: boolean }> {
  return apiFetch(`/api/market/${id}`, { method: 'DELETE' })
}

// ── Favorites ──────────────────────────────────────────────────────────────

export function getFavorites(): Promise<{ items: import('./types').ApiFavorite[]; total: number }> {
  return apiFetch('/api/favorites')
}

export function addFavorite(favoriteId: number): Promise<{ ok: boolean; id: number }> {
  return apiFetch('/api/favorites', { method: 'POST', body: JSON.stringify({ favorite_id: favoriteId }) })
}

export function removeFavorite(favoriteId: number): Promise<{ ok: boolean; removed: number }> {
  return apiFetch(`/api/favorites/${favoriteId}`, { method: 'DELETE' })
}

// ── Leaderboard ────────────────────────────────────────────────────────────

export function getLeaderboard(limit = 50): Promise<ApiLeaderboardEntry[]> {
  return apiFetch(`/api/leaderboard?limit=${limit}`)
}

// ── Duel ───────────────────────────────────────────────────────────────────

export function getDuelPlayers(search?: string): Promise<import('./types').ApiDuelPlayer[]> {
  const qs = search && search.trim().length >= 2 ? `?search=${encodeURIComponent(search.trim())}` : ''
  return apiFetch(`/api/duel/players${qs}`)
}

export function getMyActiveDuel(): Promise<{ active: boolean; duel_id?: number }> {
  return apiFetch('/api/duel/my-active')
}

export function sendDuelChallenge(defenderId: number, betAmount: number, currency: 'gold' | 'ton'): Promise<import('./types').ApiDuel> {
  return apiFetch('/api/duel/challenge', {
    method: 'POST',
    body:   JSON.stringify({ defender_id: defenderId, bet_amount: betAmount, currency }),
  })
}

export function acceptDuelChallenge(duelId: number): Promise<import('./types').ApiDuel> {
  return apiFetch(`/api/duel/${duelId}/accept`, { method: 'POST' })
}

// Challenger cancels their own pending challenge (notifies defender)
export function cancelDuelChallenge(duelId: number): Promise<{ ok: boolean }> {
  return apiFetch(`/api/duel/${duelId}/cancel`, { method: 'POST' })
}

// Defender declines incoming challenge (notifies challenger)
export function declineDuelChallenge(duelId: number): Promise<{ ok: boolean }> {
  return apiFetch(`/api/duel/${duelId}/decline`, { method: 'POST' })
}

export function submitDuelResult(duelId: number, winnerId: number): Promise<import('./types').ApiDuelResult> {
  return apiFetch(`/api/duel/${duelId}/result`, {
    method: 'POST',
    body:   JSON.stringify({ winner_id: winnerId }),
  })
}

export function getDuelHistory(): Promise<import('./types').ApiDuel[]> {
  return apiFetch('/api/duel/history')
}
