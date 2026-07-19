import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { DroneIcon, TurretIcon, UnitCircle } from '../components/UnitIcons'
import { getDroneGroups, getTurretGroups } from '../api'
import type { DroneGroup, TurretGroup } from '../api'
import type { DroneType } from '../api/types'
import styles from './EquipmentScreen.module.css'

const DRONE_TYPE_COLORS: Record<string, string> = {
  scout: '#00ccee', combat: '#ff4400', stealth: '#9900ff',
}
const DRONE_TYPE_KEYS: Record<string, string> = {
  scout: 'drone.scout', combat: 'drone.combat', stealth: 'drone.stealth',
}
const TURRET_LEVEL_COLORS: Record<number, string> = { 1: '#00cc44', 2: '#ffaa00', 3: '#ff4400' }
const TURRET_LEVEL_KEYS:   Record<number, string> = { 1: 'turret.light', 2: 'turret.medium', 3: 'turret.heavy' }

export function EquipmentScreen() {
  const { t }                = useTranslation()
  const setScreen            = useGameStore((s) => s.setScreen)
  const setEquipmentFilter   = useGameStore((s) => s.setEquipmentFilter)

  const [droneGroups,  setDroneGroups]  = useState<DroneGroup[]>([])
  const [turretGroups, setTurretGroups] = useState<TurretGroup[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [d, tr] = await Promise.all([getDroneGroups(), getTurretGroups()])
      setDroneGroups(d)
      setTurretGroups(tr)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openGroup = (kind: 'drone' | 'turret', level: number, droneType: DroneType | null = null) => {
    setEquipmentFilter({ kind, level, droneType })
    setScreen('equipment-level')
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => setScreen('farm')}>{t('common.back')}</button>
        <h2 className={styles.title}>{t('equipment.title')}</h2>
        <button
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)',
            color: '#00e5ff', padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          onClick={() => setScreen('purchases')}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          {t('equipment.historyBtn')}
        </button>
      </div>

      {loading && (
        <div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 12 }}>
          {t('app.loading')}
        </div>
      )}

      {!loading && droneGroups.length === 0 && turretGroups.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#888', fontSize: 13 }}>
          {t('equipment.myDrones')} — 0
        </div>
      )}

      {droneGroups.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('equipment.myDrones')}</h3>
          <div className={styles.grid}>
            {droneGroups.map((g) => {
              const color = DRONE_TYPE_COLORS[g.drone_type] ?? '#00e5ff'
              return (
                <div
                  key={`d-${g.level}-${g.drone_type}`}
                  className={styles.cardWrapper}
                  style={{ '--unit-color': color } as React.CSSProperties}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    className={styles.card}
                    onClick={() => openGroup('drone', g.level, g.drone_type)}
                  >
                    <div className={styles.cardGlow} />
                    <UnitCircle color={color} size={46}>
                      <DroneIcon color={color} size={26} />
                    </UnitCircle>
                    <div className={styles.cardName}>
                      {t(DRONE_TYPE_KEYS[g.drone_type] ?? 'drone.scout')}
                    </div>
                    <div className={styles.cardLevel} style={{ color }}>LVL {g.level}</div>
                    <div className={styles.upgradeCount} style={{ color, fontSize: 12, fontWeight: 700 }}>
                      × {g.count}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {turretGroups.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('equipment.myTurrets')}</h3>
          <div className={styles.grid}>
            {turretGroups.map((g) => {
              const color = TURRET_LEVEL_COLORS[g.level] ?? '#00cc44'
              return (
                <div
                  key={`t-${g.level}`}
                  className={styles.cardWrapper}
                  style={{ '--unit-color': color } as React.CSSProperties}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    className={styles.card}
                    onClick={() => openGroup('turret', g.level)}
                  >
                    <div className={styles.cardGlow} />
                    <UnitCircle color={color} size={46}>
                      <TurretIcon color={color} level={g.level as 1 | 2 | 3} size={26} />
                    </UnitCircle>
                    <div className={styles.cardName}>
                      {t(TURRET_LEVEL_KEYS[g.level] ?? 'turret.light')}
                    </div>
                    <div className={styles.cardLevel} style={{ color }}>DEF LV{g.level}</div>
                    <div className={styles.upgradeCount} style={{ color, fontSize: 12, fontWeight: 700 }}>
                      × {g.count}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
