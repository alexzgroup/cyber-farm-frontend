export interface ReferralEntry {
  level:      number
  username:   string
  first_name: string
  last_name:  string
  avatar_url?: string
  created_at: string
}

export interface ReferralStats {
  total:      number
  by_level:   { level: number; count: number }[]
  recent:     ReferralEntry[]
  ton_earned: number
}

export interface ReferralList {
  items:    ReferralEntry[]
  total:    number
  page:     number
  per_page: number
  pages:    number
}

export interface ReferralRatesLevel {
  purchase_first_ton:  number
  purchase_pct_of_ton: number
  progress_ton:        number
}

export interface DailyBonusRewardRow {
  day:  number
  gold?: number
  ton?:  number
}

export interface DailyBonusStatus {
  current_streak:  number
  next_streak:     number
  claimable:       boolean
  last_claim_at:   string | null
  rewards:         DailyBonusRewardRow[]
}

export interface DailyBonusClaim {
  streak:      number
  reward_gold: number
  reward_ton:  number
}

export interface ReferralRates {
  l1: ReferralRatesLevel
  l2: ReferralRatesLevel
  l3: ReferralRatesLevel
  progress_min_raids:   number
  progress_min_balance: number
}

export type DroneType         = 'scout' | 'combat' | 'stealth'
export type DroneUpgradeType  = 'cargo_bay' | 'stealth_module' | 'energy_cell' | 'ai_navigation' | 'armor'
export type TurretUpgradeType = 'scope' | 'firepower' | 'range' | 'reload' | 'shield'
export type UnitType          = 'drone' | 'turret'
export type RaidResultType    = 'victory' | 'defeat'
export type ListingStatus     = 'active' | 'sold' | 'cancelled'

export interface ApiUser {
  id:                 number
  telegram_id:        number
  username:           string
  first_name:         string
  last_name:          string
  balance:            number
  balance_updated_at: string   // ISO timestamp of last balance commit
  income_rate_total:  number   // coins/second from all non-broken drones
  ton_balance:        number   // real TON crypto balance
  ton_wallet:         string   // connected TON wallet address (for withdrawals)
  energy:               number
  max_energy:           number
  energy_regen_per_min: number   // server-controlled regen rate, settable via CRM
  vip_until:            string | null
  reg_language:        string   // set at registration from Telegram, immutable
  language:            string   // user-selected language (ru/en)
  allow_notification:  boolean  // false = user opted out of re-engagement reminders
  allow_duel:          boolean  // false = hidden from duel list, cannot receive challenges
  created_at:          string
}

export interface ApiWalletInvoice {
  wallet:   string   // game TON wallet address
  comment:  string   // unique deposit comment (cf-{userId}-{ts})
  deeplink: string   // ton://transfer/{wallet}?text={comment}
}

export interface ApiUserPublic {
  id:             number
  username:       string
  first_name:     string
  avatar_url?:    string
  balance:        number
  cooldown_until?: number   // unix timestamp; absent/null = can attack now
  is_online?:     boolean
  defense_power?: number
  is_favorite?:   boolean
}

export interface ApiFavorite {
  id:         number   // user id of the favorite
  username:   string
  first_name: string
  last_name:  string
  avatar_url?: string
  added_at:   string
  cooldown_until?: number  // unix ts; null = can raid now
  is_online?:  boolean
}

export interface ApiDroneUpgrade {
  id:           number
  drone_id:     number
  upgrade_type: DroneUpgradeType
  level:        number
}

export interface ApiDrone {
  id:          number
  user_id:     number
  drone_type:  DroneType
  level:       number
  health:      number
  is_broken:   boolean
  position_x:  number
  position_y:  number
  income_rate: number
  upgrades:    ApiDroneUpgrade[]
}

export interface ApiTurretUpgrade {
  id:           number
  turret_id:    number
  upgrade_type: TurretUpgradeType
  level:        number
}

export interface ApiTurret {
  id:            number
  user_id:       number
  level:         number   // mapped from turret_level in Go
  turret_level:  number   // raw from API (alias)
  position_x:    number
  position_y:    number
  defense_power: number
  upgrades:      ApiTurretUpgrade[]
}

export interface ApiRaid {
  id:               number
  attacker_id:      number
  defender_id:      number
  result:           RaidResultType
  coins_stolen:     number
  waves_completed:  number
  total_waves:      number
  attacker:         ApiUserPublic
  defender:         ApiUserPublic
  created_at:       string
  defender_turret_levels?: number[]
  broken_drone_id?: number
}

export interface RaidStats {
  total:   number
  wins:    number
  losses:  number
  streak:  number
}

export type MarketCurrency = 'gold' | 'ton'

export interface ApiMarketListing {
  id:             number
  seller_id:      number
  unit_type:      UnitType
  drone_id:       number | null
  turret_id:      number | null
  price:          number
  currency:       MarketCurrency
  status:         ListingStatus
  expires_at:     string | null
  reserved_until: number | null  // unix timestamp
  reserved_by:    number | null
  created_at:     string
  seller:     ApiUserPublic
  drone:      ApiDrone | null
  turret:     ApiTurret | null
}

export interface ApiLeaderboardEntry {
  user_id:    number
  username:   string
  first_name: string
  balance:    number
}

export interface UnitPosition {
  id:         number
  position_x: number
  position_y: number
}

export interface ApiProduct {
  id:          number
  name:        string
  description: string
  stars_price: number
  gold_amount: number
  bonus_label: string
  sort_order:  number
}

export interface ApiPurchaseLog {
  id:           number
  item_type:    'drone_buy' | 'drone_upgrade' | 'drone_equip' | 'turret_buy' | 'turret_equip'
  unit_id:      number
  unit_name:    string
  upgrade_key:  string
  upgrade_name: string
  level:        number
  cost:         number
  created_at:   string
}

export interface ContestLeaderboardEntry {
  rank:            number
  user_id:         number
  username:        string
  first_name:      string
  score:           number
  projected_prize: number
}

export interface ContestCurrent {
  pool_ton:        number
  next_contest_at: string   // ISO timestamp — next Monday 00:00 UTC
  participants:    number
  leaderboard:     ContestLeaderboardEntry[]
}

export interface ContestWinner {
  rank:       number
  user_id:    number
  username:   string
  first_name: string
  score:      number
  prize_gold: number
}

export interface ContestLast {
  contest: {
    id:         number
    week_start: string
    week_end:   string
    pool_ton:   number
  } | null
  winners: ContestWinner[]
}

export interface ApiMarketHistoryItem {
  id:           number
  direction:    'buy' | 'sell'
  unit_type:    'drone' | 'turret'
  unit_level:   number
  drone_type?:  string
  price:        number
  currency:     'gold' | 'ton'
  counterparty: string
  created_at:   string
}

export interface ApiMarketHistoryResponse {
  items: ApiMarketHistoryItem[]
  total: number
  page:  number
}

export interface AuthResponse {
  token:      string
  expires_in: number   // seconds until token expiry (1 hour = 3600)
  user:       ApiUser
}

// ── Withdrawal ────────────────────────────────────────────────────────────────

export type WithdrawalStatus = 'pending' | 'completed' | 'rejected' | 'failed' | 'pending_sign'

export interface ApiWithdrawal {
  id:         number
  amount:     number
  fee:        number
  payout:     number
  to_wallet:  string
  status:     WithdrawalStatus
  created_at: string
  updated_at: string
}

export interface ApiWithdrawalsResponse {
  withdrawals: ApiWithdrawal[]
  commission:  number
  min_amount:  number
}

// ── Duel ──────────────────────────────────────────────────────────────────────

export type DuelCurrency = 'gold' | 'ton'
export type DuelStatus   = 'pending' | 'active' | 'completed' | 'declined' | 'expired'

export interface ApiDuelPlayer {
  id:          number
  username:    string
  first_name:  string
  avatar_url?: string
  balance:     number
  ton_balance: number
  power:       number   // total battle power from all active drones + upgrades
  is_online?:  boolean
  is_favorite?: boolean
}

export interface ApiDuelChallenge {
  duel_id:          number
  challenger_id:    number
  challenger_name:  string
  challenger_power: number   // total battle power of challenger
  bet_amount:       number
  currency:         DuelCurrency
  expires_at:       number  // unix timestamp
}

export interface ApiDuel {
  id:            number
  challenger_id: number
  defender_id:   number
  bet_amount:    number
  currency:      DuelCurrency
  status:        DuelStatus
  winner_id:     number | null
  challenger:    ApiDuelPlayer | null
  defender:      ApiDuelPlayer | null
  expires_at:    string
  created_at:    string
  updated_at:    string
}

export interface ApiDuelResult {
  duel_id:   number
  winner_id: number
  loser_id:  number
  prize:     number
  currency:  DuelCurrency
}
