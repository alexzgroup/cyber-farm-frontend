import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { fmtGold } from '../utils/format'
import { getMarket, buyListing } from '../api'
import type { ApiMarketListing } from '../api/types'
import { DroneIcon, TurretIcon, UnitCircle } from '../components/UnitIcons'
import styles from './MarketScreen.module.css'

type CurrencyTab = 'gold' | 'ton'
type FilterType  = 'all' | 'drone' | 'turret'
type SortKey     = 'price-asc' | 'price-desc' | 'newest' | 'level-desc'

const PAGE_SIZE = 20

const DRONE_COLORS: Record<string, { color: string; key: string }> = {
  scout:   { color: '#00ccee', key: 'drone.scout'   },
  combat:  { color: '#ff4400', key: 'drone.combat'  },
  stealth: { color: '#9900ff', key: 'drone.stealth' },
}
const TURRET_COLORS: Record<number, { color: string; key: string }> = {
  1: { color: '#00cc44', key: 'turret.light'  },
  2: { color: '#ffaa00', key: 'turret.medium' },
  3: { color: '#ff4400', key: 'turret.heavy'  },
}

function Pagination({ page, total, pageSize, onChange }: {
  page: number; total: number; pageSize: number; onChange: (p: number) => void
}) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null
  return (
    <div className={styles.pagination}>
      <button className={styles.pageBtn} disabled={page === 0} onClick={() => onChange(page - 1)}>←</button>
      <span className={styles.pageInfo}>{page + 1} / {totalPages}</span>
      <button className={styles.pageBtn} disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)}>→</button>
    </div>
  )
}

function PriceTag({ price, currency }: { price: number; currency: 'gold' | 'ton' }) {
  if (currency === 'ton') {
    return (
      <span style={{ color: '#5b9cf6', fontWeight: 700 }}>
        ◈ {price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)} TON
      </span>
    )
  }
  return <span style={{ color: '#ffd700', fontWeight: 700 }}>⬡ {price.toLocaleString()}</span>
}

function MarketCard({ item, onBuy, canBuy }: {
  item: ApiMarketListing; onBuy: () => void; canBuy: boolean
}) {
  const { t } = useTranslation()

  const isDrone = item.unit_type === 'drone'
  const meta = isDrone
    ? (DRONE_COLORS[item.drone?.drone_type ?? 'scout'] ?? DRONE_COLORS.scout)
    : (TURRET_COLORS[(item.turret?.level ?? item.turret?.turret_level ?? 1)] ?? TURRET_COLORS[1])

  const levelLabel = isDrone
    ? `LVL ${item.drone?.level ?? 1}`
    : `DEF LV${item.turret?.level ?? item.turret?.turret_level ?? 1}`

  const upgradeCount = isDrone
    ? (item.drone?.upgrades?.length ?? 0)
    : (item.turret?.upgrades?.length ?? 0)

  const isTon = item.currency === 'ton'

  return (
    <div
      className={styles.card}
      style={{
        '--accent': meta.color,
        borderColor: isTon ? '#5b9cf6' : undefined,
      } as React.CSSProperties}
    >
      {isTon && (
        <div style={{
          position: 'absolute', top: 6, right: 6,
          background: '#1e3a5f', color: '#5b9cf6',
          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
          letterSpacing: '0.05em',
        }}>
          TON
        </div>
      )}
      <div className={styles.cardGlow} />
      <div className={styles.cardTop}>
        <UnitCircle color={meta.color} size={46}>
          {isDrone
            ? <DroneIcon  color={meta.color} size={26} />
            : <TurretIcon color={meta.color} level={item.turret?.level ?? 1} size={26} />}
        </UnitCircle>
        <div className={styles.cardTitles}>
          <div className={styles.cardName}>{t(meta.key)}</div>
          <div className={styles.cardLevel} style={{ color: meta.color }}>{levelLabel}</div>
        </div>
        <div className={styles.cardBadge} style={{ background: meta.color + '22', color: meta.color }}>
          {isDrone ? t('market.typeDrone') : t('market.typeTurret')}
        </div>
      </div>

      {upgradeCount > 0 && (
        <div className={styles.cardMeta}>
          <span className={styles.upgBadge}>⬆ {upgradeCount} {t('equipment.upgrades')}</span>
        </div>
      )}

      <div className={styles.cardSeller}>
        {t('market.seller', { name: item.seller?.username || item.seller?.first_name || `#${item.seller_id}` })}
      </div>

      <div className={styles.cardFooter}>
        <PriceTag price={item.price} currency={item.currency} />
        {isTon ? (
          <button
            className={`${styles.buyBtn} ${styles.buyTon}`}
            disabled={!canBuy}
            onClick={onBuy}
          >
            {t('market.buyTon')}
          </button>
        ) : (
          <button
            className={`${styles.buyBtn} ${canBuy ? styles.buyActive : styles.buyDisabled}`}
            style={canBuy ? { borderColor: meta.color, color: meta.color } : {}}
            disabled={!canBuy}
            onClick={onBuy}
          >
            {t('market.buy')}
          </button>
        )}
      </div>
    </div>
  )
}

export function MarketScreen() {
  const { t } = useTranslation()
  const balance    = useGameStore((s) => s.balance)
  const addBalance = useGameStore((s) => s.addBalance)

  const [currencyTab, setCurrencyTab] = useState<CurrencyTab>('gold')
  const [filterType,  setFilterType]  = useState<FilterType>('all')
  const [sortBy,      setSortBy]      = useState<SortKey>('newest')
  const [page,        setPage]        = useState(0)
  const [listings,    setListings]    = useState<ApiMarketListing[]>([])
  const [loading,     setLoading]     = useState(true)
  const [toast,       setToast]       = useState<string | null>(null)
  const [boughtIds,   setBoughtIds]   = useState<Set<number>>(new Set())

  // Load listings from real API
  useEffect(() => {
    setLoading(true)
    setPage(0)
    getMarket({ currency: currencyTab })
      .then(setListings)
      .catch(() => setListings([]))
      .finally(() => setLoading(false))
  }, [currencyTab])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  const handleBuy = async (item: ApiMarketListing) => {
    if (item.currency === 'ton') {
      showToast('TON wallet coming soon! 🔜')
      return
    }
    if (balance < item.price) return
    try {
      await buyListing(item.id)
      addBalance(-item.price)
      setBoughtIds((s) => new Set(s).add(item.id))
      const name = item.drone
        ? t(DRONE_COLORS[item.drone.drone_type]?.key ?? 'drone.scout')
        : t(TURRET_COLORS[item.turret?.level ?? 1]?.key ?? 'turret.light')
      showToast(`${name} — ${t('market.buy').toLowerCase()}!`)
    } catch {
      showToast('Purchase failed')
    }
  }

  const filtered = useMemo(() => {
    let list = listings.filter((i) => !boughtIds.has(i.id))
    if (filterType !== 'all') list = list.filter((i) => i.unit_type === filterType)
    switch (sortBy) {
      case 'price-asc':  return [...list].sort((a, b) => a.price - b.price)
      case 'price-desc': return [...list].sort((a, b) => b.price - a.price)
      case 'level-desc': return [...list].sort((a, b) => {
        const la = a.drone?.level ?? a.turret?.level ?? 1
        const lb = b.drone?.level ?? b.turret?.level ?? 1
        return lb - la
      })
      default: return list
    }
  }, [listings, filterType, sortBy, boughtIds])

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const onCurrency = (tab: CurrencyTab) => { setCurrencyTab(tab); setPage(0); setFilterType('all') }
  const onFilter   = (f: FilterType)   => { setFilterType(f);  setPage(0) }
  const onSort     = (s: SortKey)      => { setSortBy(s);      setPage(0) }

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>{t('market.title')}</h2>
        <span className={styles.balance}>⬡ {fmtGold(balance)}</span>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      {/* Currency tabs — Gold / TON */}
      <div style={{ display: 'flex', gap: 8, padding: '0 12px 8px' }}>
        {(['gold', 'ton'] as CurrencyTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => onCurrency(tab)}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
              background:   currencyTab === tab ? (tab === 'ton' ? '#1e3a5f' : '#1a2e1a') : 'transparent',
              color:        tab === 'ton' ? '#5b9cf6' : '#ffd700',
              borderColor:  tab === 'ton' ? '#5b9cf6' : '#ffd700',
              opacity:      currencyTab === tab ? 1 : 0.45,
            }}
          >
            {tab === 'gold' ? `⬡ ${t('market.tabGold')}` : `◈ ${t('market.tabTon')}`}
          </button>
        ))}
      </div>

      {/* Type filters + sort */}
      <div className={styles.filterBar}>
        <div className={styles.typeFilters}>
          {(['all', 'drone', 'turret'] as FilterType[]).map((f) => (
            <button
              key={f}
              className={`${styles.chip} ${filterType === f ? styles.chipActive : ''}`}
              onClick={() => onFilter(f)}
            >
              {f === 'all' ? t('market.filterAll') : f === 'drone' ? `🔵 ${t('market.filterDrones')}` : `🛡 ${t('market.filterTurrets')}`}
            </button>
          ))}
        </div>
        <select className={styles.sortSelect} value={sortBy} onChange={(e) => onSort(e.target.value as SortKey)}>
          <option value="newest">{t('market.sortNewest')}</option>
          <option value="price-asc">{t('market.sortPriceAsc')}</option>
          <option value="price-desc">{t('market.sortPriceDesc')}</option>
          <option value="level-desc">{t('market.sortLevelDesc')}</option>
        </select>
      </div>

      <div className={styles.statsBar}>
        <span>{filtered.length} {t('market.filterAll').toLowerCase()}</span>
      </div>

      {/* Listings */}
      {loading ? (
        <div className={styles.empty}>{t('market.loading')}</div>
      ) : paged.length === 0 ? (
        <div className={styles.empty}>{t('market.noListings')}</div>
      ) : (
        <div className={styles.grid}>
          {paged.map((item) => (
            <MarketCard
              key={item.id}
              item={item}
              canBuy={item.currency === 'ton' || balance >= item.price}
              onBuy={() => handleBuy(item)}
            />
          ))}
        </div>
      )}

      <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </div>
  )
}
