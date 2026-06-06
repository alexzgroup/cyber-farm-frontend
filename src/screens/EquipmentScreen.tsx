import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { DRONE_UPGRADE_TEMPLATES, TURRET_UPGRADE_TEMPLATES } from '../data/unitUpgrades'
import { DroneIcon, TurretIcon, UnitCircle } from '../components/UnitIcons'
import styles from './EquipmentScreen.module.css'

const DRONE_TYPE_COLORS: Record<number, string> = {
  1: '#00ccee',
  2: '#ff4400',
  3: '#9900ff',
}

const DRONE_TYPE_KEYS: Record<number, string> = {
  1: 'drone.scout',
  2: 'drone.combat',
  3: 'drone.stealth',
}

const TURRET_LEVEL_COLORS: Record<number, string> = {
  1: '#00cc44',
  2: '#ffaa00',
  3: '#ff4400',
}

const TURRET_LEVEL_KEYS: Record<number, string> = {
  1: 'turret.light',
  2: 'turret.medium',
  3: 'turret.heavy',
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
          {t('common.back')}
        </button>
        <h2 className={styles.title}>{t('equipment.title')}</h2>
      </div>

      {/* Drones section */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('equipment.myDrones')}</h3>
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
                <UnitCircle color={color} size={46}>
                  {drone.isBroken
                    ? <span style={{ fontSize: 20 }}>⚠</span>
                    : <DroneIcon color={color} size={26} />}
                </UnitCircle>
                <div className={styles.cardName}>
                  {t(DRONE_TYPE_KEYS[drone.droneType] ?? 'drone.scout')} #{idx + 1}
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
                  {t('equipment.upgradesOf', {done: totalUpgrades, total: maxUpgrades})}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Turrets section */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('equipment.myTurrets')}</h3>
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
                <UnitCircle color={color} size={46}>
                  <TurretIcon color={color} level={turret.level} size={26} />
                </UnitCircle>
                <div className={styles.cardName}>
                  {t(TURRET_LEVEL_KEYS[turret.level] ?? 'turret.light')} #{idx + 1}
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
                  {t('equipment.upgradesOf', {done: totalUpgrades, total: maxUpgrades})}
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
