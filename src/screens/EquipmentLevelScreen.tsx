import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { DRONE_UPGRADE_TEMPLATES, TURRET_UPGRADE_TEMPLATES } from '../data/unitUpgrades'
import { DroneIcon, TurretIcon, UnitCircle } from '../components/UnitIcons'
import { SellModal } from '../components/SellModal'
import {
  getDronesPaged, getTurretsPaged, getMarket, cancelListing,
} from '../api'
import type { ApiDrone, ApiTurret, ApiMarketListing, DroneType } from '../api/types'
import styles from './EquipmentScreen.module.css'
import levelStyles from './EquipmentLevelScreen.module.css'

const DRONE_TYPE_COLORS: Record<string, string> = {
  scout: '#00ccee', combat: '#ff4400', stealth: '#9900ff',
}
const DRONE_TYPE_KEYS: Record<string, string> = {
  scout: 'drone.scout', combat: 'drone.combat', stealth: 'drone.stealth',
}
const TURRET_LEVEL_COLORS: Record<number, string> = { 1: '#00cc44', 2: '#ffaa00', 3: '#ff4400' }
const TURRET_LEVEL_KEYS:   Record<number, string> = { 1: 'turret.light', 2: 'turret.medium', 3: 'turret.heavy' }

const LIMIT = 30

export function EquipmentLevelScreen() {
  const { t }              = useTranslation()
  const filter             = useGameStore((s) => s.equipmentFilter)
  const setEquipmentFilter = useGameStore((s) => s.setEquipmentFilter)
  const setScreen          = useGameStore((s) => s.setScreen)
  const selectUnit         = useGameStore((s) => s.selectUnit)
  const unitUpgrades       = useGameStore((s) => s.unitUpgrades)

  const [kind, setKind]           = useState<'drone' | 'turret'>(filter?.kind ?? 'drone')
  const [level, setLevel]         = useState<number | null>(filter?.level ?? null)
  const [droneType, setDroneType] = useState<DroneType | null>(filter?.droneType ?? null)
  const [page, setPage]           = useState(1)

  const [drones,  setDrones]  = useState<ApiDrone[]>([])
  const [turrets, setTurrets] = useState<ApiTurret[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [myListings, setMyListings] = useState<ApiMarketListing[]>([])
  const [sellTarget, setSellTarget] = useState<{ id: number; type: 'drone' | 'turret'; name: string } | null>(null)

  const fetchMyListings = useCallback(async () => {
    try { setMyListings(await getMarket({ mine: true })) } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchMyListings() }, [fetchMyListings])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [kind, level, droneType])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (kind === 'drone') {
        const res = await getDronesPaged({
          level:      level ?? undefined,
          drone_type: droneType ?? undefined,
          page,
          limit:      LIMIT,
        })
        setDrones(res.items)
        setTurrets([])
        setTotal(res.total)
      } else {
        const res = await getTurretsPaged({
          level: level ?? undefined,
          page,
          limit: LIMIT,
        })
        setTurrets(res.items)
        setDrones([])
        setTotal(res.total)
      }
    } finally { setLoading(false) }
  }, [kind, level, droneType, page])

  useEffect(() => { load() }, [load])

  const listedDrones  = useMemo(
    () => new Map(myListings.filter(l => l.drone_id).map(l => [l.drone_id!, l.id])),
    [myListings],
  )
  const listedTurrets = useMemo(
    () => new Map(myListings.filter(l => l.turret_id).map(l => [l.turret_id!, l.id])),
    [myListings],
  )

  const handleCancelListing = async (e: React.MouseEvent, listingId: number) => {
    e.stopPropagation()
    try {
      await cancelListing(listingId)
      fetchMyListings()
    } catch { /* ignore */ }
  }

  const countUpgrades = (unitId: string, templates: typeof DRONE_UPGRADE_TEMPLATES) => {
    const ups = unitUpgrades[unitId] ?? {}
    return templates.reduce((sum, t) => sum + (ups[t.id] ?? 0), 0)
  }

  const openUnit = (id: number) => {
    selectUnit(String(id))
    setScreen('unit-detail')
  }

  const back = () => {
    setEquipmentFilter(null)
    setScreen('equipment')
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

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

      <div className={styles.header}>
        <button className={styles.backBtn} onClick={back}>{t('common.back')}</button>
        <h2 className={styles.title}>{t('equipment.title')}</h2>
      </div>

      <div className={levelStyles.filters}>
        <label className={levelStyles.filterField}>
          <span className={levelStyles.filterLabel}>{t('equipment.filterType')}</span>
          <select
            className={levelStyles.select}
            value={kind}
            onChange={(e) => {
              const v = e.target.value as 'drone' | 'turret'
              setKind(v)
              if (v === 'turret') setDroneType(null)
            }}
          >
            <option value="drone">{t('equipment.myDrones')}</option>
            <option value="turret">{t('equipment.myTurrets')}</option>
          </select>
        </label>

        <label className={levelStyles.filterField}>
          <span className={levelStyles.filterLabel}>{t('equipment.filterLevel')}</span>
          <select
            className={levelStyles.select}
            value={level ?? ''}
            onChange={(e) => setLevel(e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">{t('equipment.filterAll')}</option>
            <option value="1">LVL 1</option>
            <option value="2">LVL 2</option>
            <option value="3">LVL 3</option>
          </select>
        </label>

        {kind === 'drone' && (
          <label className={levelStyles.filterField}>
            <span className={levelStyles.filterLabel}>{t('equipment.filterKind')}</span>
            <select
              className={levelStyles.select}
              value={droneType ?? ''}
              onChange={(e) => setDroneType((e.target.value || null) as DroneType | null)}
            >
              <option value="">{t('equipment.filterAll')}</option>
              <option value="scout">{t('drone.scout')}</option>
              <option value="combat">{t('drone.combat')}</option>
              <option value="stealth">{t('drone.stealth')}</option>
            </select>
          </label>
        )}
      </div>

      <div className={levelStyles.summary}>
        {t('equipment.total', { count: total })}
      </div>

      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 12 }}>
          {t('app.loading')}
        </div>
      ) : (
        <>
          <section className={styles.section}>
            <div className={styles.grid}>
              {kind === 'drone' && drones.map((d, idx) => {
                const color = DRONE_TYPE_COLORS[d.drone_type] ?? '#00e5ff'
                const totalUpgrades = countUpgrades(String(d.id), DRONE_UPGRADE_TEMPLATES)
                const maxUpgrades   = DRONE_UPGRADE_TEMPLATES.length * 3
                const listingId = listedDrones.get(d.id)
                const isListed  = listingId !== undefined
                return (
                  <div key={d.id} className={styles.cardWrapper} style={{ '--unit-color': color } as React.CSSProperties}>
                    <div
                      role="button"
                      tabIndex={0}
                      className={`${styles.card} ${d.is_broken ? styles.broken : ''} ${isListed ? styles.listed : ''}`}
                      onClick={() => openUnit(d.id)}
                    >
                      <div className={styles.cardGlow} />
                      {isListed && <div className={styles.forSaleBadge}>{t('sell.forSale')}</div>}
                      <UnitCircle color={color} size={46}>
                        {d.is_broken ? <span style={{ fontSize: 20 }}>⚠</span> : <DroneIcon color={color} size={26} />}
                      </UnitCircle>
                      <div className={styles.cardName}>
                        {t(DRONE_TYPE_KEYS[d.drone_type] ?? 'drone.scout')} #{(page - 1) * LIMIT + idx + 1}
                      </div>
                      <div className={styles.cardLevel} style={{ color }}>
                        LVL {d.level}{d.is_broken ? ' ⚠' : ''}
                      </div>
                      <div className={styles.upgradeBar}>
                        <div className={styles.upgradeBarFill}
                          style={{ width: `${(totalUpgrades / maxUpgrades) * 100}%`, background: color }} />
                      </div>
                      <div className={styles.upgradeCount} style={{ color }}>
                        {t('equipment.upgradesOf', { done: totalUpgrades, total: maxUpgrades })}
                      </div>
                    </div>
                    {isListed ? (
                      <div role="button" className={styles.cancelBtn}
                        onClick={e => handleCancelListing(e, listingId!)}>
                        ✕ {t('sell.cancelListing')}
                      </div>
                    ) : (
                      <div role="button" className={styles.sellBtn}
                        onClick={() => setSellTarget({
                          id: d.id, type: 'drone',
                          name: `${t(DRONE_TYPE_KEYS[d.drone_type] ?? 'drone.scout')} LVL${d.level}`,
                        })}>
                        <span style={{ opacity: 0.8 }}>◈</span>{t('sell.sellBtn')}
                      </div>
                    )}
                  </div>
                )
              })}

              {kind === 'turret' && turrets.map((tr, idx) => {
                const lv = tr.turret_level ?? tr.level ?? 1
                const color = TURRET_LEVEL_COLORS[lv] ?? '#00cc44'
                const totalUpgrades = countUpgrades(String(tr.id), TURRET_UPGRADE_TEMPLATES)
                const maxUpgrades   = TURRET_UPGRADE_TEMPLATES.length * 3
                const listingId = listedTurrets.get(tr.id)
                const isListed  = listingId !== undefined
                return (
                  <div key={tr.id} className={styles.cardWrapper} style={{ '--unit-color': color } as React.CSSProperties}>
                    <div
                      role="button"
                      tabIndex={0}
                      className={`${styles.card} ${isListed ? styles.listed : ''}`}
                      onClick={() => openUnit(tr.id)}
                    >
                      <div className={styles.cardGlow} />
                      {isListed && <div className={styles.forSaleBadge}>{t('sell.forSale')}</div>}
                      <UnitCircle color={color} size={46}>
                        <TurretIcon color={color} level={lv} size={26} />
                      </UnitCircle>
                      <div className={styles.cardName}>
                        {t(TURRET_LEVEL_KEYS[lv] ?? 'turret.light')} #{(page - 1) * LIMIT + idx + 1}
                      </div>
                      <div className={styles.cardLevel} style={{ color }}>DEF LV{lv}</div>
                      <div className={styles.upgradeBar}>
                        <div className={styles.upgradeBarFill}
                          style={{ width: `${(totalUpgrades / maxUpgrades) * 100}%`, background: color }} />
                      </div>
                      <div className={styles.upgradeCount} style={{ color }}>
                        {t('equipment.upgradesOf', { done: totalUpgrades, total: maxUpgrades })}
                      </div>
                    </div>
                    {isListed ? (
                      <div role="button" className={styles.cancelBtn}
                        onClick={e => handleCancelListing(e, listingId!)}>
                        ✕ {t('sell.cancelListing')}
                      </div>
                    ) : (
                      <div role="button" className={styles.sellBtn}
                        onClick={() => setSellTarget({
                          id: tr.id, type: 'turret',
                          name: `${t(TURRET_LEVEL_KEYS[lv] ?? 'turret.light')} DEF LV${lv}`,
                        })}>
                        <span style={{ opacity: 0.8 }}>◈</span>{t('sell.sellBtn')}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {totalPages > 1 && (
            <div className={levelStyles.pagination}>
              <button
                className={levelStyles.pageBtn}
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                ‹
              </button>
              <span className={levelStyles.pageInfo}>
                {t('equipment.pageOf', { page, total: totalPages })}
              </span>
              <button
                className={levelStyles.pageBtn}
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
