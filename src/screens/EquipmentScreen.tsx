import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { DRONE_UPGRADE_TEMPLATES, TURRET_UPGRADE_TEMPLATES } from '../data/unitUpgrades'
import { DroneIcon, TurretIcon, UnitCircle } from '../components/UnitIcons'
import { SellModal } from '../components/SellModal'
import { getMarket, cancelListing } from '../api'
import type { ApiMarketListing } from '../api/types'
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
  const { t }        = useTranslation()
  const drones       = useGameStore((s) => s.drones)
  const turrets      = useGameStore((s) => s.turrets)
  const unitUpgrades = useGameStore((s) => s.unitUpgrades)
  const selectUnit   = useGameStore((s) => s.selectUnit)
  const setScreen    = useGameStore((s) => s.setScreen)

  const [sellTarget, setSellTarget] = useState<{
    id: number; type: 'drone' | 'turret'; name: string
  } | null>(null)
  const [myListings, setMyListings] = useState<ApiMarketListing[]>([])

  const fetchMyListings = useCallback(async () => {
    try { setMyListings(await getMarket({ mine: true })) } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchMyListings() }, [fetchMyListings])

  // Maps: unit DB id → listing id (for cancel)
  const listedDrones  = new Map(myListings.filter(l => l.drone_id).map(l => [l.drone_id!, l.id]))
  const listedTurrets = new Map(myListings.filter(l => l.turret_id).map(l => [l.turret_id!, l.id]))

  const handleCancelListing = async (e: React.MouseEvent, listingId: number) => {
    e.stopPropagation()
    try {
      await cancelListing(listingId)
      fetchMyListings()
    } catch { /* ignore */ }
  }

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
      {sellTarget && (
        <SellModal
          unitId={sellTarget.id}
          unitType={sellTarget.type}
          unitName={sellTarget.name}
          onClose={() => setSellTarget(null)}
          onSold={() => { setSellTarget(null); setScreen('market') }}
        />
      )}
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => setScreen('farm')}>
          {t('common.back')}
        </button>
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

      {/* Drones section */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('equipment.myDrones')}</h3>
        <div className={styles.grid}>
          {drones.map((drone, idx) => {
            const color = DRONE_TYPE_COLORS[drone.droneType] ?? '#00e5ff'
            const totalUpgrades = countUpgrades(drone.id, DRONE_UPGRADE_TEMPLATES)
            const maxUpgrades   = DRONE_UPGRADE_TEMPLATES.length * 3

            const droneListingId = listedDrones.get(Number(drone.id))
            const isListed = droneListingId !== undefined

            return (
              <div
                key={drone.id}
                role="button"
                tabIndex={0}
                className={`${styles.card} ${drone.isBroken ? styles.broken : ''} ${isListed ? styles.listed : ''}`}
                style={{ '--unit-color': color } as React.CSSProperties}
                onClick={() => handleSelectDrone(drone.id)}
              >
                <div className={styles.cardGlow} />
                {isListed && <div className={styles.forSaleBadge}>{t('sell.forSale')}</div>}
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
                {isListed ? (
                  <div
                    role="button"
                    className={styles.cancelBtn}
                    onClick={e => handleCancelListing(e, droneListingId)}
                  >
                    ✕ {t('sell.cancelListing')}
                  </div>
                ) : (
                  <div
                    role="button"
                    className={styles.sellBtn}
                    onClick={e => {
                      e.stopPropagation()
                      setSellTarget({
                        id: Number(drone.id),
                        type: 'drone',
                        name: `${t(DRONE_TYPE_KEYS[drone.droneType] ?? 'drone.scout')} #${idx + 1} LVL${drone.level}`,
                      })
                    }}
                  >
                    📤 {t('sell.sellBtn')}
                  </div>
                )}
              </div>
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

            const turretListingId = listedTurrets.get(Number(turret.id))
            const isListed = turretListingId !== undefined

            return (
              <div
                key={turret.id}
                role="button"
                tabIndex={0}
                className={`${styles.card} ${isListed ? styles.listed : ''}`}
                style={{ '--unit-color': color } as React.CSSProperties}
                onClick={() => handleSelectTurret(turret.id)}
              >
                <div className={styles.cardGlow} />
                {isListed && <div className={styles.forSaleBadge}>{t('sell.forSale')}</div>}
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
                {isListed ? (
                  <div
                    role="button"
                    className={styles.cancelBtn}
                    onClick={e => handleCancelListing(e, turretListingId)}
                  >
                    ✕ {t('sell.cancelListing')}
                  </div>
                ) : (
                  <div
                    role="button"
                    className={styles.sellBtn}
                    onClick={e => {
                      e.stopPropagation()
                      setSellTarget({
                        id: Number(turret.id),
                        type: 'turret',
                        name: `${t(TURRET_LEVEL_KEYS[turret.level] ?? 'turret.light')} #${idx + 1} DEF LV${turret.level}`,
                      })
                    }}
                  >
                    📤 {t('sell.sellBtn')}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
