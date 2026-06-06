import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { MOCK_MARKET, timeAgo, type MarketListing } from '../data/mockMarket'
import { DroneIcon, TurretIcon, UnitCircle } from '../components/UnitIcons'
import styles from './MarketScreen.module.css'

type FilterType = 'all' | 'drone' | 'turret'
type SortKey    = 'price-asc' | 'price-desc' | 'newest' | 'level-desc'

const PAGE_SIZE = 20

// Static color/emoji data — names resolved via t() inside components
const DRONE_COLORS: Record<number, { color: string; emoji: string; key: string }> = {
  1: { color: '#00ccee', emoji: '🔵', key: 'drone.scout'   },
  2: { color: '#ff4400', emoji: '🔴', key: 'drone.combat'  },
  3: { color: '#9900ff', emoji: '🟣', key: 'drone.stealth' },
}

const TURRET_COLORS: Record<number, { color: string; emoji: string; key: string }> = {
  1: { color: '#00cc44', emoji: '🟢', key: 'turret.light'  },
  2: { color: '#ffaa00', emoji: '🟡', key: 'turret.medium' },
  3: { color: '#ff4400', emoji: '🔴', key: 'turret.heavy'  },
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

function MarketCard({ item, onBuy, canAfford }: {
  item: MarketListing; onBuy: () => void; canAfford: boolean
}) {
  const { t } = useTranslation()

  const meta = item.type === 'drone'
    ? DRONE_COLORS[item.droneType ?? 1]
    : TURRET_COLORS[item.turretLevel ?? 1]

  const levelLabel = item.type === 'drone'
    ? `LVL ${item.droneLevel}`
    : `DEF LV${item.turretLevel}`

  return (
    <div className={styles.card} style={{ '--accent': meta.color } as React.CSSProperties}>
      <div className={styles.cardGlow} />
      <div className={styles.cardTop}>
        <UnitCircle color={meta.color} size={46}>
          {item.type === 'drone'
            ? <DroneIcon  color={meta.color} size={26} />
            : <TurretIcon color={meta.color} level={item.turretLevel ?? 1} size={26} />}
        </UnitCircle>
        <div className={styles.cardTitles}>
          <div className={styles.cardName}>{t(meta.key)}</div>
          <div className={styles.cardLevel} style={{ color: meta.color }}>{levelLabel}</div>
        </div>
        <div className={styles.cardBadge} style={{ background: meta.color + '22', color: meta.color }}>
          {item.type === 'drone' ? t('market.typeDrone') : t('market.typeTurret')}
        </div>
      </div>

      <div className={styles.cardMeta}>
        {item.upgradesCount > 0 && (
          <span className={styles.upgBadge}>⬆ {item.upgradesCount} {t('equipment.upgrades')}</span>
        )}
        <span className={styles.timeLabel}>{timeAgo(item.listedAt)}</span>
      </div>

      <div className={styles.cardSeller}>{t('market.seller', { name: item.sellerName })}</div>

      <div className={styles.cardFooter}>
        <span className={styles.price}>⬡ {item.price.toLocaleString()}</span>
        <button
          className={`${styles.buyBtn} ${canAfford ? styles.buyActive : styles.buyDisabled}`}
          style={canAfford ? { borderColor: meta.color, color: meta.color } : {}}
          disabled={!canAfford}
          onClick={onBuy}
        >
          {t('market.buy')}
        </button>
      </div>
    </div>
  )
}

export function MarketScreen() {
  const { t } = useTranslation()
  const balance    = useGameStore((s) => s.balance)
  const addBalance = useGameStore((s) => s.addBalance)

  const [filterType, setFilterType] = useState<FilterType>('all')
  const [sortBy,  setSortBy]        = useState<SortKey>('newest')
  const [page,    setPage]          = useState(0)
  const [bought,  setBought]        = useState<Set<string>>(new Set())
  const [toast,   setToast]         = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  const handleBuy = (item: MarketListing) => {
    if (balance < item.price) return
    addBalance(-item.price)
    setBought((s) => new Set(s).add(item.id))
    const meta = item.type === 'drone'
      ? DRONE_COLORS[item.droneType ?? 1]
      : TURRET_COLORS[item.turretLevel ?? 1]
    showToast(`${t(meta.key)} ⬡ ${item.price}`)
  }

  const filtered = useMemo(() => {
    let list = MOCK_MARKET.filter((i) => !bought.has(i.id))
    if (filterType !== 'all') list = list.filter((i) => i.type === filterType)
    switch (sortBy) {
      case 'price-asc':  list = [...list].sort((a, b) => a.price - b.price); break
      case 'price-desc': list = [...list].sort((a, b) => b.price - a.price); break
      case 'newest':     list = [...list].sort((a, b) => b.listedAt - a.listedAt); break
      case 'level-desc':
        list = [...list].sort((a, b) => {
          const la = a.type === 'drone' ? (a.droneLevel ?? 1) : (a.turretLevel ?? 1)
          const lb = b.type === 'drone' ? (b.droneLevel ?? 1) : (b.turretLevel ?? 1)
          return lb - la
        })
        break
    }
    return list
  }, [filterType, sortBy, bought])

  const FILTER_LABELS: Record<FilterType, string> = {
    all:    t('market.filterAll'),
    drone:  `🔵 ${t('market.filterDrones')}`,
    turret: `🛡 ${t('market.filterTurrets')}`,
  }

  const paged    = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const onFilter = (f: FilterType) => { setFilterType(f); setPage(0) }
  const onSort   = (s: SortKey)    => { setSortBy(s);     setPage(0) }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('market.title')}</h2>
        <span className={styles.balance}>⬡ {balance.toFixed(0)}</span>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.filterBar}>
        <div className={styles.typeFilters}>
          {(['all', 'drone', 'turret'] as FilterType[]).map((f) => (
            <button
              key={f}
              className={`${styles.chip} ${filterType === f ? styles.chipActive : ''}`}
              onClick={() => onFilter(f)}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
        <select
          className={styles.sortSelect}
          value={sortBy}
          onChange={(e) => onSort(e.target.value as SortKey)}
        >
          <option value="newest">{t('market.sortNewest')}</option>
          <option value="price-asc">{t('market.sortPriceAsc')}</option>
          <option value="price-desc">{t('market.sortPriceDesc')}</option>
          <option value="level-desc">{t('market.sortLevelDesc')}</option>
        </select>
      </div>

      <div className={styles.statsBar}>
        <span>{filtered.length} {t('market.filterAll').toLowerCase()}</span>
        <span>{bought.size} {t('market.buy').toLowerCase()}</span>
      </div>

      {paged.length === 0 ? (
        <div className={styles.empty}>{t('market.noListings')}</div>
      ) : (
        <div className={styles.grid}>
          {paged.map((item) => (
            <MarketCard
              key={item.id}
              item={item}
              canAfford={balance >= item.price}
              onBuy={() => handleBuy(item)}
            />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        total={filtered.length}
        pageSize={PAGE_SIZE}
        onChange={setPage}
      />
    </div>
  )
}
