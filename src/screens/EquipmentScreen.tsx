import { useGameStore } from '../store/gameStore'
import { DRONE_UPGRADE_TEMPLATES, TURRET_UPGRADE_TEMPLATES } from '../data/unitUpgrades'
import styles from './EquipmentScreen.module.css'

const DRONE_TYPE_COLORS: Record<number, string> = {
  1: '#00ccee',
  2: '#ff4400',
  3: '#9900ff',
}

const DRONE_TYPE_NAMES: Record<number, string> = {
  1: 'Разведчик',
  2: 'Боевой',
  3: 'Стелс',
}

const TURRET_LEVEL_COLORS: Record<number, string> = {
  1: '#00cc44',
  2: '#ffaa00',
  3: '#ff4400',
}

const TURRET_LEVEL_NAMES: Record<number, string> = {
  1: 'Лёгкая',
  2: 'Средняя',
  3: 'Тяжёлая',
}

export function EquipmentScreen() {
  const drones       = useGameStore((s) => s.drones)
  const turrets      = useGameStore((s) => s.turrets)
  const unitUpgrades = useGameStore((s) => s.unitUpgrades)
  const selectUnit   = useGameStore((s) => s.selectUnit)
  const setScreen    = useGameStore((s) => s.setScreen)

  const handleSelectDrone = (id: string) => {
    selectUnit(id)
    setScreen('unit-detail')
  }

  const handleSelectTurret = (id: string) => {
    selectUnit(id)
    setScreen('unit-detail')
  }

  const countUpgrades = (unitId: string, templates: typeof DRONE_UPGRADE_TEMPLATES) => {
    const ups = unitUpgrades[unitId] ?? {}
    return templates.reduce((sum, t) => sum + (ups[t.id] ?? 0), 0)
  }

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => setScreen('farm')}>
          ← Назад
        </button>
        <h2 className={styles.title}>Оборудование</h2>
      </div>

      {/* Drones section */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>⚡ Мои дроны</h3>
        <div className={styles.grid}>
          {drones.map((drone, idx) => {
            const color = DRONE_TYPE_COLORS[drone.droneType] ?? '#00e5ff'
            const totalUpgrades = countUpgrades(drone.id, DRONE_UPGRADE_TEMPLATES)
            const maxUpgrades   = DRONE_UPGRADE_TEMPLATES.length * 3

            return (
              <button
                key={drone.id}
                className={`${styles.card} ${drone.isBroken ? styles.broken : ''}`}
                style={{ '--unit-color': color } as React.CSSProperties}
                onClick={() => handleSelectDrone(drone.id)}
              >
                <div className={styles.cardGlow} />
                <div className={styles.cardIcon}>
                  {drone.isBroken ? '⚠' : drone.droneType === 1 ? '🔵' : drone.droneType === 2 ? '🔴' : '🟣'}
                </div>
                <div className={styles.cardName}>
                  {DRONE_TYPE_NAMES[drone.droneType] ?? 'Дрон'} #{idx + 1}
                </div>
                <div className={styles.cardLevel} style={{ color }}>
                  LVL {drone.level}{drone.isBroken ? ' ⚠' : ''}
                </div>
                <div className={styles.upgradeBar}>
                  <div
                    className={styles.upgradeBarFill}
                    style={{ width: `${(totalUpgrades / maxUpgrades) * 100}%`, background: color }}
                  />
                </div>
                <div className={styles.upgradeCount} style={{ color }}>
                  {totalUpgrades}/{maxUpgrades} улучшений
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Turrets section */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>🛡 Башни защиты</h3>
        <div className={styles.grid}>
          {turrets.map((turret, idx) => {
            const color = TURRET_LEVEL_COLORS[turret.level] ?? '#00cc44'
            const totalUpgrades = countUpgrades(turret.id, TURRET_UPGRADE_TEMPLATES)
            const maxUpgrades   = TURRET_UPGRADE_TEMPLATES.length * 3

            return (
              <button
                key={turret.id}
                className={styles.card}
                style={{ '--unit-color': color } as React.CSSProperties}
                onClick={() => handleSelectTurret(turret.id)}
              >
                <div className={styles.cardGlow} />
                <div className={styles.cardIcon}>
                  {turret.level === 1 ? '🟢' : turret.level === 2 ? '🟡' : '🔴'}
                </div>
                <div className={styles.cardName}>
                  {TURRET_LEVEL_NAMES[turret.level] ?? 'Башня'} #{idx + 1}
                </div>
                <div className={styles.cardLevel} style={{ color }}>
                  DEF LV{turret.level}
                </div>
                <div className={styles.upgradeBar}>
                  <div
                    className={styles.upgradeBarFill}
                    style={{ width: `${(totalUpgrades / maxUpgrades) * 100}%`, background: color }}
                  />
                </div>
                <div className={styles.upgradeCount} style={{ color }}>
                  {totalUpgrades}/{maxUpgrades} улучшений
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
