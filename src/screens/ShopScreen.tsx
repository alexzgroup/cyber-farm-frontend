import { useTranslation } from 'react-i18next'
import { useGameStore, DRONE_UPGRADES, REPAIR_COSTS } from '../store/gameStore'
import { fmtGold } from '../utils/format'
import styles from './ShopScreen.module.css'

const TURRET_CONFIGS: Array<{ level: 1 | 2 | 3; icon: string; price: number; defense: number; nameKey: string }> = [
  { level: 1, icon: '🗼', price: 500,  defense: 25, nameKey: 'turret.light'  },
  { level: 2, icon: '🏰', price: 1500, defense: 55, nameKey: 'turret.medium' },
  { level: 3, icon: '⚔️', price: 3500, defense: 95, nameKey: 'turret.heavy'  },
]

export function ShopScreen() {
  const balance      = useGameStore((s) => s.balance)
  const drones       = useGameStore((s) => s.drones)
  const upgradeDrone = useGameStore((s) => s.upgradeDrone)
  const repairDrone  = useGameStore((s) => s.repairDrone)
  const buyDrone     = useGameStore((s) => s.buyDrone)
  const buyTurret    = useGameStore((s) => s.buyTurret)
  const setScreen    = useGameStore((s) => s.setScreen)
  const { t } = useTranslation()

  const brokenDrones   = drones.filter((d) => d.isBroken)
  const newDronePrice  = 300 + drones.length * 200

  return (
    <div className={styles.screen}>
      <h2 className={styles.title}>{t('shop.title')}</h2>
      <p className={styles.balance}>⬡ {fmtGold(balance)}</p>

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
                  <div className={styles.droneIcon}>💀</div>
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
                  {drone.isBroken ? '💀' : drone.level === 1 ? '🤖' : drone.level === 2 ? '⚡' : '💎'}
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
                    className={`${styles.btn} ${canAfford ? styles.btnActive : styles.btnDisabled}`}
                    onClick={() => upgradeDrone(drone.id)}
                    disabled={!canAfford}
                  >
                    <span className={styles.btnLevel}>{t('shop.upgrade', { n: next.level })}</span>
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
          <div className={styles.droneIcon}>⚙️</div>
          <div className={styles.cardInfo}>
            <p className={styles.droneName}>{t('shop.boostDrones')}</p>
            <p className={styles.droneStats}>{t('shop.upgradeEquipSub')}</p>
          </div>
          <button className={`${styles.btn} ${styles.btnActive}`} onClick={() => setScreen('equipment')}>
            <span className={styles.btnLevel}>{t('shop.open')}</span>
            <span className={styles.btnPrice}>→</span>
          </button>
        </div>
      </section>

      {/* Buy new drone */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('shop.newDrone')}</h3>
        <div className={styles.card}>
          <div className={styles.droneIcon}>🤖</div>
          <div className={styles.cardInfo}>
            <p className={styles.droneName}>{t('drone.basic')}</p>
            <p className={styles.droneStats}>{t('shop.stats', {hr: 10, tap: 0.1})}</p>
          </div>
          <button
            className={`${styles.btn} ${balance >= newDronePrice ? styles.btnActive : styles.btnDisabled}`}
            onClick={() => buyDrone()}
            disabled={balance < newDronePrice}
          >
            <span className={styles.btnLevel}>{t('shop.buy')}</span>
            <span className={styles.btnPrice}>⬡ {newDronePrice}</span>
          </button>
        </div>
      </section>

      {/* Buy new turret */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('shop.newTurret')}</h3>
        <div className={styles.cards}>
          {TURRET_CONFIGS.map(({ level, icon, price, defense, nameKey }) => {
            const canAfford = balance >= price
            return (
              <div key={level} className={styles.card}>
                <div className={styles.droneIcon}>{icon}</div>
                <div className={styles.cardInfo}>
                  <p className={styles.droneName}>{t(nameKey)}</p>
                  <p className={styles.droneStats}>{t('shop.turretDefense', { n: defense })}</p>
                </div>
                <button
                  className={`${styles.btn} ${canAfford ? styles.btnActive : styles.btnDisabled}`}
                  onClick={() => buyTurret(level)}
                  disabled={!canAfford}
                >
                  <span className={styles.btnLevel}>{t('shop.buy')}</span>
                  <span className={styles.btnPrice}>⬡ {price}</span>
                </button>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
