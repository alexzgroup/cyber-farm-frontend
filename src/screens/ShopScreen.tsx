import { useGameStore, DRONE_UPGRADES, REPAIR_COSTS } from '../store/gameStore'
import styles from './ShopScreen.module.css'

export function ShopScreen() {
  const balance      = useGameStore((s) => s.balance)
  const drones       = useGameStore((s) => s.drones)
  const upgradeDrone = useGameStore((s) => s.upgradeDrone)
  const repairDrone  = useGameStore((s) => s.repairDrone)
  const buyDrone     = useGameStore((s) => s.buyDrone)
  const setScreen    = useGameStore((s) => s.setScreen)

  const brokenDrones   = drones.filter((d) => d.isBroken)
  const newDronePrice  = 300 + drones.length * 200

  return (
    <div className={styles.screen}>
      <h2 className={styles.title}>Магазин</h2>
      <p className={styles.balance}>⬡ {balance.toFixed(1)}</p>

      {/* Repair section — shown only when drones are broken */}
      {brokenDrones.length > 0 && (
        <section className={styles.section}>
          <h3 className={`${styles.sectionTitle} ${styles.sectionDanger}`}>⚠ Починка</h3>
          <div className={styles.cards}>
            {brokenDrones.map((drone) => {
              const cost       = REPAIR_COSTS[drone.level]
              const canAfford  = balance >= cost
              const info       = DRONE_UPGRADES[drone.level - 1]
              return (
                <div key={drone.id} className={`${styles.card} ${styles.cardBroken}`}>
                  <div className={styles.droneIcon}>💀</div>
                  <div className={styles.cardInfo}>
                    <p className={styles.droneName}>{info.name}</p>
                    <p className={styles.droneStats}>{Math.round(info.tapBonus * 36000) / 100} / час · не работает</p>
                    <p className={styles.broken}>Сломан после рейда</p>
                  </div>
                  <button
                    className={`${styles.btn} ${canAfford ? styles.btnRepair : styles.btnDisabled}`}
                    onClick={() => repairDrone(drone.id)}
                    disabled={!canAfford}
                  >
                    <span className={styles.btnLevel}>Починить</span>
                    <span className={styles.btnPrice}>⬡ {cost}</span>
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Upgrade existing drones */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Мои дроны</h3>
        <div className={styles.cards}>
          {drones.map((drone) => {
            const current   = DRONE_UPGRADES[drone.level - 1]
            const next      = drone.level < 3 ? DRONE_UPGRADES[drone.level] : null
            const canAfford = next ? balance >= next.price : false

            return (
              <div key={drone.id} className={`${styles.card} ${drone.isBroken ? styles.cardBroken : ''}`}>
                <div className={styles.droneIcon}>
                  {drone.isBroken ? '💀' : drone.level === 1 ? '🤖' : drone.level === 2 ? '⚡' : '💎'}
                </div>
                <div className={styles.cardInfo}>
                  <p className={styles.droneName}>{current.name}</p>
                  <p className={styles.droneStats}>
                    {"-"} / час · +{current.tapBonus} за клик
                  </p>
                  {drone.isBroken && <p className={styles.broken}>Сломан</p>}
                </div>
                {!drone.isBroken && next ? (
                  <button
                    className={`${styles.btn} ${canAfford ? styles.btnActive : styles.btnDisabled}`}
                    onClick={() => upgradeDrone(drone.id)}
                    disabled={!canAfford}
                  >
                    <span className={styles.btnLevel}>Ур. {next.level}</span>
                    <span className={styles.btnPrice}>⬡ {next.price}</span>
                  </button>
                ) : !drone.isBroken ? (
                  <span className={styles.maxLevel}>MAX</span>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>

      {/* Equipment upgrades link */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Улучшение оборудования</h3>
        <div className={styles.card} style={{ cursor: 'pointer' }} onClick={() => setScreen('equipment')}>
          <div className={styles.droneIcon}>⚙️</div>
          <div className={styles.cardInfo}>
            <p className={styles.droneName}>Прокачка башен и дронов</p>
            <p className={styles.droneStats}>5 улучшений для каждого юнита · 3 уровня</p>
          </div>
          <button className={`${styles.btn} ${styles.btnActive}`} onClick={() => setScreen('equipment')}>
            <span className={styles.btnLevel}>Открыть</span>
            <span className={styles.btnPrice}>→</span>
          </button>
        </div>
      </section>

      {/* Buy new drone */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Новый дрон</h3>
        <div className={styles.card}>
          <div className={styles.droneIcon}>🤖</div>
          <div className={styles.cardInfo}>
            <p className={styles.droneName}>Базовый дрон</p>
            <p className={styles.droneStats}>10 / час · +0.1 за клик</p>
          </div>
          <button
            className={`${styles.btn} ${balance >= newDronePrice ? styles.btnActive : styles.btnDisabled}`}
            onClick={() => buyDrone()}
            disabled={balance < newDronePrice}
          >
            <span className={styles.btnLevel}>Купить</span>
            <span className={styles.btnPrice}>⬡ {newDronePrice}</span>
          </button>
        </div>
      </section>
    </div>
  )
}
