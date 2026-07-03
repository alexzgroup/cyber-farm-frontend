import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useGameStore, DRONE_UPGRADES, REPAIR_COSTS } from '../store/gameStore'
import { STARTER_PACK, starterDiscountPct } from '../constants/starter'
import { fmtGold } from '../utils/format'
import { DroneIcon, TurretIcon, UnitCircle, WrenchIcon } from '../components/UnitIcons'
import { ShieldModal } from '../components/ShieldModal'
import { RescueBundleCard } from '../components/RescueBundleCard'
import { CouponBanner } from '../components/CouponBanner'
import { formatCountdown, useNowSecond } from '../utils/countdown'
import styles from './ShopScreen.module.css'

const DRONE_COLORS: Record<number, string> = { 1: '#00ccee', 2: '#ff4400', 3: '#9900ff' }
const TURRET_COLORS: Record<1 | 2 | 3, string> = { 1: '#00cc44', 2: '#ffaa00', 3: '#ff4400' }

const TURRET_CONFIGS: Array<{ level: 1 | 2 | 3; price: number; defense: number; nameKey: string }> = [
  { level: 1, price: 500,  defense: 25, nameKey: 'turret.light'  },
  { level: 2, price: 1500, defense: 55, nameKey: 'turret.medium' },
  { level: 3, price: 3500, defense: 95, nameKey: 'turret.heavy'  },
]

export function ShopScreen() {
  const balance      = useGameStore((s) => s.balance)
  const drones       = useGameStore((s) => s.drones)
  const upgradeDrone = useGameStore((s) => s.upgradeDrone)
  const repairDrone  = useGameStore((s) => s.repairDrone)
  const buyDrone     = useGameStore((s) => s.buyDrone)
  const buyTurret    = useGameStore((s) => s.buyTurret)
  const setScreen    = useGameStore((s) => s.setScreen)
  const hasStarsPurchase = useGameStore((s) => s.hasStarsPurchase)
  const starterExpiresAt = useGameStore((s) => s.starterExpiresAt)
  const now = useNowSecond()
  const starterCountdown = starterExpiresAt ? formatCountdown(starterExpiresAt, now) : ''
  const starterExpired   = starterExpiresAt !== null && !starterCountdown
  const { t } = useTranslation()

  const [buyingTurret, setBuyingTurret] = useState<number | null>(null)
  const [turretToast,  setTurretToast]  = useState('')
  const [buyingDrone,  setBuyingDrone]  = useState(false)
  const [upgradingId,  setUpgradingId]  = useState<string | null>(null)
  const [shieldOpen,   setShieldOpen]   = useState(false)

  const brokenDrones   = drones.filter((d) => d.isBroken)
  const newDronePrice  = 300 + drones.length * 200

  const handleBuyTurret = async (level: 1 | 2 | 3) => {
    setBuyingTurret(level)
    const ok = await buyTurret(level)
    setBuyingTurret(null)
    if (ok) {
      setTurretToast(t('shop.turretBought'))
      setTimeout(() => setTurretToast(''), 2500)
    }
  }

  const handleBuyDrone = async () => {
    if (buyingDrone) return
    setBuyingDrone(true)
    try { await buyDrone() } finally { setBuyingDrone(false) }
  }

  const handleUpgradeDrone = async (id: string) => {
    if (upgradingId) return
    setUpgradingId(id)
    try { await upgradeDrone(id) } finally { setUpgradingId(null) }
  }

  return (
    <div className={styles.screen}>
      <h2 className={styles.title}>{t('shop.title')}</h2>
      <p className={styles.balance}>⬡ {fmtGold(balance)}</p>

      {/* Coupon banner — explains the -30% discount and countdown. */}
      <CouponBanner />

      {/* Starter Pack offer — highlighted for users who never bought Stars,
          and only while the 48h FOMO timer is still ticking. */}
      {!hasStarsPurchase && !starterExpired && (
        <button
          type="button"
          className={styles.starterBanner}
          onClick={() => setScreen('topup')}
          aria-label={t('starter.hudLabel')}
          data-testid="starter-pack-banner"
        >
          <span className={styles.starterBannerSheen} />
          <span className={styles.starterBannerBadge}>
            {t('starter.shopDiscount', { pct: starterDiscountPct() })}
          </span>
          <span className={styles.starterBannerIcon}>⭐</span>
          <span className={styles.shieldBannerText}>
            <span className={styles.shieldBannerTitle}>
              {t('starter.shopTitle', { stars: STARTER_PACK.stars })}
            </span>
            <span className={styles.shieldBannerSub}>
              <Trans
                i18nKey="starter.shopSubDays"
                count={STARTER_PACK.bonusDays}
                values={{ gold: STARTER_PACK.goldAmount, count: STARTER_PACK.bonusDays }}
                components={{ b: <b /> }}
              />
            </span>
            {starterCountdown && (
              <span className={styles.starterBannerLimited} data-testid="starter-timer">
                ⏱ {t('starterTimer.expiresIn', { time: starterCountdown })}
              </span>
            )}
            {!starterCountdown && (
              <span className={styles.starterBannerLimited}>{t('starter.limited')}</span>
            )}
          </span>
          <span className={styles.shieldBannerArrow}>→</span>
        </button>
      )}

      {/* Rescue Bundle upsell — appears once the user has bought Starter. */}
      <RescueBundleCard />

      {/* Shield offer banner — top, animated */}
      <button
        type="button"
        className={styles.shieldBanner}
        onClick={() => setShieldOpen(true)}
        aria-label="Купить щит от рейдов"
      >
        <span className={styles.shieldBannerSheen} />
        <span className={styles.shieldBannerIcon}>🛡</span>
        <span className={styles.shieldBannerText}>
          <span className={styles.shieldBannerTitle}>Щит от рейдов</span>
          <span className={styles.shieldBannerSub}>1 день — 15 ⭐. Никто не атакует ферму.</span>
        </span>
        <span className={styles.shieldBannerArrow}>→</span>
      </button>

      {/* Repair section */}
      {brokenDrones.length > 0 && (
        <section className={styles.section}>
          <h3 className={`${styles.sectionTitle} ${styles.sectionDanger}`}>{t('shop.repairSection')}</h3>
          <div className={styles.cards}>
            {brokenDrones.map((drone) => {
              const cost      = REPAIR_COSTS[drone.level]
              const canAfford = balance >= cost
              const info      = DRONE_UPGRADES[drone.level - 1]
              return (
                <div key={drone.id} className={`${styles.card} ${styles.cardBroken}`}>
                  <div className={styles.droneIcon}>
                    <UnitCircle color="#888" size={48}><DroneIcon color="#888" size={26}/></UnitCircle>
                  </div>
                  <div className={styles.cardInfo}>
                    <p className={styles.droneName}>{t('drone.level' + drone.level) || info.name}</p>
                    <p className={styles.droneStats}>{Math.round(info.tapBonus * 36000) / 100} / час · {t('shop.brokenLabel')}</p>
                    <p className={styles.broken}>{t('shop.brokenAfterRaid')}</p>
                  </div>
                  <button
                    className={`${styles.btn} ${canAfford ? styles.btnRepair : styles.btnDisabled}`}
                    onClick={() => repairDrone(drone.id)}
                    disabled={!canAfford}
                  >
                    <span className={styles.btnLevel}>{t('shop.repair')}</span>
                    <span className={styles.btnPrice}>⬡ {cost}</span>
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* My drones — with income per hour */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('shop.myDrones')}</h3>
        <div className={styles.cards}>
          {drones.map((drone) => {
            const current    = DRONE_UPGRADES[drone.level - 1]
            const next       = drone.level < 3 ? DRONE_UPGRADES[drone.level] : null
            const canAfford  = next ? balance >= next.price : false
            const incomeHour = (drone.incomePerSec * 3600).toFixed(2)

            return (
              <div key={drone.id} className={`${styles.card} ${drone.isBroken ? styles.cardBroken : ''}`}>
                <div className={styles.droneIcon}>
                  {drone.isBroken
                    ? <UnitCircle color="#888" size={48}><DroneIcon color="#888" size={26}/></UnitCircle>
                    : <UnitCircle color={DRONE_COLORS[drone.droneType]} size={48}><DroneIcon color={DRONE_COLORS[drone.droneType]} size={26}/></UnitCircle>
                  }
                </div>
                <div className={styles.cardInfo}>
                  <p className={styles.droneName}>{current.name}</p>
                  <p className={styles.droneStats}>
                    ⬡ {incomeHour} / {t('shop.hour')} · +{current.tapBonus} {t('shop.perTap')}
                  </p>
                  {drone.isBroken && <p className={styles.broken}>{t('shop.brokenLabel')}</p>}
                </div>
                {!drone.isBroken && next ? (
                  <button
                    className={`${styles.btn} ${canAfford && upgradingId !== drone.id ? styles.btnActive : styles.btnDisabled}`}
                    onClick={() => handleUpgradeDrone(drone.id)}
                    disabled={!canAfford || upgradingId !== null}
                  >
                    <span className={styles.btnLevel}>{upgradingId === drone.id ? '...' : t('shop.upgrade', { n: next.level })}</span>
                    <span className={styles.btnPrice}>⬡ {next.price}</span>
                  </button>
                ) : !drone.isBroken ? (
                  <span className={styles.maxLevel}>{t('shop.maxLevel')}</span>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>

      {/* Equipment upgrades link */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('shop.upgradeEquip')}</h3>
        <div className={styles.card} style={{ cursor: 'pointer' }} onClick={() => setScreen('equipment')}>
          <div className={styles.droneIcon}>
            <UnitCircle color="#ffaa00" size={52}><WrenchIcon color="#ffaa00" size={30}/></UnitCircle>
          </div>
          <div className={styles.cardInfo}>
            <p className={styles.droneName}>{t('shop.boostDrones')}</p>
            <p className={styles.droneStats}>{t('shop.upgradeEquipSub')}</p>
          </div>
          <button className={`${styles.btn} ${styles.btnActive}`} onClick={() => setScreen('equipment')}>
            <span className={styles.btnLevel}>{t('shop.open')}</span>
          </button>
        </div>
      </section>

      {/* Buy new drone */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('shop.newDrone')}</h3>
        <div className={styles.card}>
          <div className={styles.droneIcon}>
            <UnitCircle color="#00ccee" size={48}><DroneIcon color="#00ccee" size={26}/></UnitCircle>
          </div>
          <div className={styles.cardInfo}>
            <p className={styles.droneName}>{t('drone.basic')}</p>
            <p className={styles.droneStats}>{t('shop.stats', {hr: 4.32, tap: 0.1})}</p>
          </div>
          <button
            className={`${styles.btn} ${balance >= newDronePrice && !buyingDrone ? styles.btnActive : styles.btnDisabled}`}
            onClick={handleBuyDrone}
            disabled={balance < newDronePrice || buyingDrone}
          >
            <span className={styles.btnLevel}>{buyingDrone ? '...' : t('shop.buy')}</span>
            <span className={styles.btnPrice}>⬡ {newDronePrice}</span>
          </button>
        </div>
      </section>

      {/* Buy new turret */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('shop.newTurret')}</h3>
        {turretToast && (
          <div className={styles.toast} style={{ color: '#39ff14', marginBottom: 8 }}>
            ✓ {turretToast}
          </div>
        )}
        <div className={styles.cards}>
          {TURRET_CONFIGS.map(({ level, price, defense, nameKey }) => {
            const canAfford = balance >= price
            const loading   = buyingTurret === level
            return (
              <div key={level} className={styles.card}>
                <div className={styles.droneIcon}>
                  <UnitCircle color={TURRET_COLORS[level]} size={48}><TurretIcon color={TURRET_COLORS[level]} level={level} size={26}/></UnitCircle>
                </div>
                <div className={styles.cardInfo}>
                  <p className={styles.droneName}>{t(nameKey)}</p>
                  <p className={styles.droneStats}>{t('shop.turretDefense', { n: defense })}</p>
                </div>
                <button
                  className={`${styles.btn} ${canAfford && !loading ? styles.btnActive : styles.btnDisabled}`}
                  onClick={() => handleBuyTurret(level)}
                  disabled={!canAfford || loading}
                >
                  <span className={styles.btnLevel}>{loading ? '...' : t('shop.buy')}</span>
                  <span className={styles.btnPrice}>⬡ {price}</span>
                </button>
              </div>
            )
          })}
        </div>
      </section>

      <ShieldModal open={shieldOpen} onClose={() => setShieldOpen(false)} />
    </div>
  )
}
