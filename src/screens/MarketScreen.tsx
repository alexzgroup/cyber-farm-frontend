import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { fmtGold } from '../utils/format'
import { getMarket, reserveListing, buyListing, getWalletRate, buyListingWithStars, getMarketFees } from '../api'
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

function PriceTag({ price, currency, starsPerTon }: {
  price: number; currency: 'gold' | 'ton'; starsPerTon?: number
}) {
  if (currency === 'ton') {
    const stars = starsPerTon && starsPerTon > 0 ? Math.ceil(price * starsPerTon) : null
    return (
      <div>
        <span style={{ color: '#5b9cf6', fontWeight: 700 }}>
          ◈ {parseFloat(price.toFixed(4))} TON
        </span>
        {stars && (
          <div style={{ fontSize: 11, color: '#a855f7', marginTop: 2 }}>
            ~{stars.toLocaleString()} ⭐
          </div>
        )}
      </div>
    )
  }
  return <span style={{ color: '#ffd700', fontWeight: 700 }}>⬡ {price.toLocaleString()}</span>
}

function MarketCard({ item, onBuy, onBuyStars, canBuy, starsPerTon, sellerRate, currentUserId }: {
  item: ApiMarketListing; onBuy: () => void; onBuyStars?: () => void
  canBuy: boolean; starsPerTon?: number; sellerRate?: number; currentUserId?: number
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
  const isOwnListing = currentUserId != null && item.seller_id === currentUserId

  // Determine if this listing is reserved by someone else
  const nowSec = Math.floor(Date.now() / 1000)
  const isReservedByOther =
    item.reserved_until != null &&
    item.reserved_until > nowSec &&
    item.reserved_by != null &&
    item.reserved_by !== currentUserId

  return (
    <div
      className={styles.card}
      style={{
        '--accent': meta.color,
        borderColor: isTon ? '#5b9cf6' : undefined,
        opacity: isReservedByOther ? 0.4 : 1,
        position: 'relative',
      } as React.CSSProperties}
    >
      {isTon && !isReservedByOther && (
        <div style={{
          position: 'absolute', top: 6, right: 6,
          background: '#1e3a5f', color: '#5b9cf6',
          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
          letterSpacing: '0.05em',
        }}>
          TON
        </div>
      )}
      {isReservedByOther && (
        <div style={{
          position: 'absolute', top: 6, right: 6,
          background: '#2d1b1b', color: '#f87171',
          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
          letterSpacing: '0.04em',
        }}>
          Зарезервирован
        </div>
      )}
      <div className={styles.cardGlow} />
      <div className={styles.cardTop}>
        <UnitCircle color={meta.color} size={46}>
          {isDrone
            ? <DroneIcon  color={meta.color} size={26} />
            : <TurretIcon color={meta.color} level={(item.turret?.level ?? 1) as 1 | 2 | 3} size={26} />}
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
          <span className={styles.upgBadge}>⬆ {t('market.upgrades', { count: upgradeCount })}</span>
        </div>
      )}

      <div className={styles.cardSeller}>
        {t('market.seller', { name: item.seller?.username || item.seller?.first_name || 'Игрок' })}
      </div>

      <div className={styles.cardFooter}>
        {/* Price row */}
        <PriceTag price={item.price} currency={item.currency} starsPerTon={starsPerTon} />

        {/* Buttons row — hidden for own listings */}
        {isOwnListing ? null : isTon ? (
          <>
            <div className={styles.buyLabel}>КУПИТЬ</div>
            <div className={styles.cardBtns}>
              <button
                className={`${styles.buyBtn} ${styles.buyTon}`}
                disabled={!canBuy || isReservedByOther}
                onClick={onBuy}
              >
                ◈ TON
              </button>
              {onBuyStars && (
                <button
                  className={`${styles.buyBtn} ${styles.buyStars}`}
                  disabled={isReservedByOther}
                  onClick={onBuyStars}
                >
                  ⭐ Stars
                </button>
              )}
            </div>
          </>
        ) : (
          <div className={styles.cardBtns}>
            <button
              className={`${styles.buyBtn} ${canBuy ? styles.buyActive : styles.buyDisabled}`}
              style={canBuy ? { borderColor: meta.color, color: meta.color } : {}}
              onClick={onBuy}
            >
              {canBuy ? t('market.buy') : '⬡ ' + t('market.buy')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function MarketScreen() {
  const { t } = useTranslation()
  const balance         = useGameStore((s) => s.balance)
  const tonBalance      = useGameStore((s) => s.tonBalance)
  const setTonBalance   = useGameStore((s) => s.setTonBalance)
  const addBalance      = useGameStore((s) => s.addBalance)
  const loadGameState   = useGameStore((s) => s.loadGameState)
  const setScreen       = useGameStore((s) => s.setScreen)

  const userID = useGameStore((s) => s.userId)

  const [currencyTab,      setCurrencyTab]      = useState<CurrencyTab>('gold')
  const [filterType,       setFilterType]       = useState<FilterType>('all')
  const [sortBy,           setSortBy]           = useState<SortKey>('newest')
  const [page,             setPage]             = useState(0)
  const [listings,         setListings]         = useState<ApiMarketListing[]>([])
  const [loading,          setLoading]          = useState(true)
  const [toast,            setToast]            = useState<string | null>(null)
  const [boughtIds,        setBoughtIds]        = useState<Set<number>>(new Set())
  const [insufficientItem,    setInsufficientItem]    = useState<ApiMarketListing | null>(null)
  const [insufficientTonItem, setInsufficientTonItem] = useState<ApiMarketListing | null>(null)
  const [starsPerTon,     setStarsPerTon]     = useState(0)
  const [sellerRate,      setSellerRate]      = useState<number | undefined>(undefined)

  // Fetch Stars/TON rate and market fees once
  useEffect(() => {
    getWalletRate().then(r => setStarsPerTon(r.stars_per_ton ?? 0)).catch(() => {})
    getMarketFees().then(f => setSellerRate(f.seller_rate)).catch(() => {})
  }, [])

  // Load listings from real API
  useEffect(() => {
    setLoading(true)
    setPage(0)
    getMarket({ currency: currencyTab })
      .then(setListings)
      .catch(() => setListings([]))
      .finally(() => setLoading(false))
  }, [currencyTab])

  const handleBuyStars = async (item: ApiMarketListing) => {
    try {
      const res = await buyListingWithStars(item.id)
      const tgWebApp = window.Telegram?.WebApp
      if (tgWebApp?.openInvoice) {
        tgWebApp.openInvoice(res.invoice_url, (status) => {
          if (status === 'paid') {
            setBoughtIds(s => new Set(s).add(item.id))
            showToast('⭐ Куплено за Stars!')
            loadGameState()
          } else if (status !== 'cancelled') {
            showToast(t('market.purchaseFailed'))
          }
        })
      } else {
        showToast('Dev mode: ' + res.invoice_url)
      }
    } catch (e: any) {
      if (e?.status === 409) {
        const remaining = e?.data?.remaining ?? 0
        showToast(`Лот зарезервирован, подождите ${remaining} сек`)
      } else {
        showToast(t('market.purchaseFailed'))
      }
    }
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  const handleBuy = async (item: ApiMarketListing) => {
    if (item.currency === 'ton') {
      if (tonBalance < item.price) {
        setInsufficientTonItem(item)
        return
      }
      try {
        await reserveListing(item.id)
        await buyListing(item.id)
        setBoughtIds((s) => new Set(s).add(item.id))
        showToast('◈ ' + t('market.bought'))
        loadGameState()
      } catch (e: any) {
        if (e?.status === 409) showToast(t('market.reserved'))
        else if (e?.status === 402) setInsufficientTonItem(item)
        else showToast(t('market.purchaseFailed'))
      }
      return
    }
    // Insufficient gold funds
    if (balance < item.price) {
      setInsufficientItem(item)
      return
    }
    try {
      // Step 1: reserve the lot for 1 minute
      await reserveListing(item.id)
      // Step 2: complete the purchase
      await buyListing(item.id)
      addBalance(-item.price)
      setBoughtIds((s) => new Set(s).add(item.id))
      const name = item.drone
        ? t(DRONE_COLORS[item.drone.drone_type]?.key ?? 'drone.scout')
        : t(TURRET_COLORS[item.turret?.level ?? 1]?.key ?? 'turret.light')
      showToast(`${name} — ${t('market.buy').toLowerCase()}!`)
      loadGameState()
    } catch (e: any) {
      if (e?.status === 409) {
        showToast(t('market.reserved'))
      } else if (e?.status === 402) {
        setInsufficientItem(item)
      } else {
        showToast(t('market.purchaseFailed'))
      }
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

      {/* Insufficient funds overlay */}
      {insufficientItem && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          zIndex: 600, paddingBottom: 60,
        }} onClick={() => setInsufficientItem(null)}>
          <div style={{
            width: '100%', maxWidth: 420,
            background: '#111827', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '18px 18px 0 0', padding: '24px 20px 28px',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 10 }}>⬡</div>
            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
              {t('market.insufficientTitle')}
            </div>
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 20 }}>
              {t('market.insufficientDesc', {
                need: fmtGold(insufficientItem.price),
                have: fmtGold(balance),
                diff: fmtGold(insufficientItem.price - balance),
              })}
            </div>
            <button
              style={{
                width: '100%', padding: 14,
                background: 'linear-gradient(135deg,#7c3aed,#5b21b6)',
                border: 'none', borderRadius: 12, color: '#fff',
                fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 10,
              }}
              onClick={() => { setInsufficientItem(null); setScreen('topup') }}
            >
              ⭐ {t('market.buyGold')}
            </button>
            <button
              style={{
                width: '100%', padding: 12, background: 'transparent',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12,
                color: 'rgba(255,255,255,0.45)', fontSize: 13, cursor: 'pointer',
              }}
              onClick={() => setInsufficientItem(null)}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Insufficient TON overlay */}
      {insufficientTonItem && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          zIndex: 600, paddingBottom: 60,
        }} onClick={() => setInsufficientTonItem(null)}>
          <div style={{
            width: '100%', maxWidth: 420,
            background: '#0f172a', border: '1px solid rgba(54,179,246,0.3)',
            borderRadius: '18px 18px 0 0', padding: '24px 20px 28px',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 10 }}>◈</div>
            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
              {t('market.insufficientTonTitle')}
            </div>
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 20 }}>
              {t('market.insufficientTonDesc', {
                need: insufficientTonItem.price.toFixed(4),
                have: tonBalance.toFixed(4),
              })}
            </div>
            <button
              style={{
                width: '100%', padding: 14,
                background: 'linear-gradient(135deg,#1e40af,#1d4ed8)',
                border: '1px solid rgba(54,179,246,0.4)', borderRadius: 12,
                color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 10,
              }}
              onClick={() => { setInsufficientTonItem(null); setScreen('profile') }}
            >
              ◈ {t('market.topupTon')}
            </button>
            <button
              style={{
                width: '100%', padding: 12, background: 'transparent',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12,
                color: 'rgba(255,255,255,0.45)', fontSize: 13, cursor: 'pointer',
              }}
              onClick={() => setInsufficientTonItem(null)}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>{t('market.title')}</h2>
        <button
          onClick={() => setScreen('market-history')}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)',
            borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
            color: '#00e5ff', fontSize: 12, fontWeight: 700,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          {t('market.historyBtn')}
        </button>
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
              canBuy={item.currency === 'ton' ? tonBalance >= item.price : balance >= item.price}
              onBuy={() => handleBuy(item)}
              onBuyStars={item.currency === 'ton' ? () => handleBuyStars(item) : undefined}
              starsPerTon={starsPerTon}
              sellerRate={sellerRate}
              currentUserId={userID}
            />
          ))}
        </div>
      )}

      <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
    </div>
  )
}
