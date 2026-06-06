export type DroneType         = 'scout' | 'combat' | 'stealth'
export type DroneUpgradeType  = 'cargo_bay' | 'stealth_module' | 'energy_cell' | 'ai_navigation' | 'armor'
export type TurretUpgradeType = 'scope' | 'firepower' | 'range' | 'reload' | 'shield'
export type UnitType          = 'drone' | 'turret'
export type RaidResultType    = 'victory' | 'defeat'
export type ListingStatus     = 'active' | 'sold' | 'cancelled'

export interface ApiUser {
  id:           number
  telegram_id:  number
  username:     string
  first_name:   string
  last_name:    string
  balance:      number
  energy:       number
  max_energy:   number
  vip_until:    string | null
  reg_language: string   // set at registration from Telegram, immutable
  language:     string   // user-selected language (ru/en)
  created_at:   string
}

export interface ApiUserPublic {
  id:         number
  username:   string
  first_name: string
  balance:    number
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
}

export type MarketCurrency = 'gold' | 'ton'

export interface ApiMarketListing {
  id:         number
  seller_id:  number
  unit_type:  UnitType
  drone_id:   number | null
  turret_id:  number | null
  price:      number
  currency:   MarketCurrency  // 'gold' = in-game coins, 'ton' = TON crypto
  status:     ListingStatus
  expires_at: string | null
  created_at: string
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

export interface AuthResponse {
  token:      string
  expires_in: number   // seconds until token expiry (1 hour = 3600)
  user:       ApiUser
}
