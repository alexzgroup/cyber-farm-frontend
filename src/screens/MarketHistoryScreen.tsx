import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { getMarketHistory } from '../api'
import type { ApiMarketHistoryItem } from '../api/types'
import styles from './MarketHistoryScreen.module.css'

const PAGE_SIZE = 20

const DRONE_COLORS: Record<string, string> = {
  scout:   '#00ccee',
  combat:  '#ff4400',
  stealth: '#9900ff',
}
const TURRET_COLORS: Record<number, string> = { 1: '#00cc44', 2: '#ffaa00', 3: '#ff4400' }

function formatDate(iso: string): string {
  const d = new Date(iso)
  const day  = d.getDate().toString().padStart(2, '0')
  const mon  = (d.getMonth() + 1).toString().padStart(2, '0')
  const h    = d.getHours().toString().padStart(2, '0')
  const m    = d.getMinutes().toString().padStart(2, '0')
  return `${day}.${mon} ${h}:${m}`
}

function unitColor(item: ApiMarketHistoryItem): string {
  if (item.unit_type === 'drone') return DRONE_COLORS[item.drone_type ?? 'scout'] ?? '#00ccee'
  return TURRET_COLORS[item.unit_level] ?? '#00cc44'
}

function UnitIcon({ item }: { item: ApiMarketHistoryItem }) {
  const color = unitColor(item)
  if (item.unit_type === 'drone') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="4" fill={color} opacity="0.9"/>
        <line x1="12" y1="8" x2="8"  y2="4"  stroke={color} strokeWidth="2" strokeLinecap="round"/>
        <line x1="12" y1="8" x2="16" y2="4"  stroke={color} strokeWidth="2" strokeLinecap="round"/>
        <line x1="12" y1="16" x2="8"  y2="20" stroke={color} strokeWidth="2" strokeLinecap="round"/>
        <line x1="12" y1="16" x2="16" y2="20" stroke={color} strokeWidth="2" strokeLinecap="round"/>
        <circle cx="8"  cy="4"  r="2" fill={color}/>
        <circle cx="16" cy="4"  r="2" fill={color}/>
        <circle cx="8"  cy="20" r="2" fill={color}/>
        <circle cx="16" cy="20" r="2" fill={color}/>
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="7" y="10" width="10" height="10" rx="2" fill={color} opacity="0.85"/>
      <rect x="9" y="6"  width="6"  height="6"  rx="1" fill={color}/>
      <rect x="11" y="3" width="2"  height="4"  rx="1" fill={color}/>
    </svg>
  )
}

function HistoryRow({ item }: { item: ApiMarketHistoryItem }) {
  const { t } = useTranslation()
  const isBuy  = item.direction === 'buy'
  const isTon  = item.currency  === 'ton'
  const color  = unitColor(item)

  let unitName = ''
  if (item.unit_type === 'drone') {
    const key = `market.unitDrone${item.drone_type ? item.drone_type.charAt(0).toUpperCase() + item.drone_type.slice(1) : 'Scout'}`
    unitName = t(key)
  } else {
    unitName = t('market.unitTurret')
  }

  const counterText = isBuy
    ? t('market.fromUser', { name: item.counterparty || '—' })
    : t('market.toUser',   { name: item.counterparty || '—' })

  const priceStr = isTon
    ? `◈ ${parseFloat(item.price.toFixed(4))}`
    : `⬡ ${item.price.toLocaleString('ru')}`

  return (
    <div className={styles.row}>
      {/* Icon */}
      <div
        className={styles.icon}
        style={{ background: color + '18', border: `1px solid ${color}40` }}
      >
        <UnitIcon item={item} />
      </div>

      {/* Unit name + level */}
      <div className={styles.unitInfo}>
        <div className={styles.unitName}>{unitName}</div>
        <div className={styles.unitLevel}>LVL {item.unit_level}</div>
      </div>

      {/* Direction badge */}
      <div className={`${styles.badge} ${isBuy ? styles.badgeBuy : styles.badgeSell}`}>
        {isBuy ? t('market.dirBuy') : t('market.dirSell')}
      </div>

      {/* Counterparty */}
      <div className={styles.counterparty}>{counterText}</div>

      {/* Price + date */}
      <div className={styles.right}>
        <span className={`${styles.price} ${isTon ? styles.priceTon : styles.priceGold}`}>
          {priceStr}
        </span>
        <span className={styles.date}>{formatDate(item.created_at)}</span>
      </div>
    </div>
  )
}

export function MarketHistoryScreen() {
  const { t }      = useTranslation()
  const setScreen  = useGameStore((s) => s.setScreen)

  const [items,   setItems]   = useState<ApiMarketHistoryItem[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getMarketHistory(page)
      .then((res) => { setItems(res.items ?? []); setTotal(res.total ?? 0) })
      .catch(() => { setItems([]); setTotal(0) })
      .finally(() => setLoading(false))
  }, [page])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => setScreen('market')} aria-label="Назад">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <span className={styles.title}>{t('market.historyTitle')}</span>
        {total > 0 && <span className={styles.count}>{total}</span>}
      </div>

      {/* Content */}
      {loading ? (
        <div className={styles.empty}>
          <div className={styles.emptyText} style={{ color: 'rgba(255,255,255,0.25)' }}>
            {t('market.loading')}
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📋</div>
          <div className={styles.emptyText}>{t('market.historyEmpty')}</div>
        </div>
      ) : (
        <div className={styles.list}>
          {items.map((item) => <HistoryRow key={item.id} item={item} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            ←
          </button>
          <span className={styles.pageInfo}>{page + 1} / {totalPages}</span>
          <button
            className={styles.pageBtn}
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}
