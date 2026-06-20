import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { getReferralList } from '../api'
import type { ReferralEntry } from '../api/types'

const LEVEL_COLORS: Record<number, string> = {
  1: '#22d3ee',
  2: '#a78bfa',
  3: '#fb923c',
  4: '#4ade80',
  5: '#f472b6',
}

export function ReferralsScreen() {
  const { t }       = useTranslation()
  const setScreen   = useGameStore((s) => s.setScreen)

  const [items, setItems]   = useState<ReferralEntry[]>([])
  const [page, setPage]     = useState(1)
  const [pages, setPages]   = useState(1)
  const [total, setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getReferralList(page)
      .then((data) => {
        setItems(data.items)
        setTotal(data.total)
        setPages(data.pages)
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [page])

  const displayName = (r: ReferralEntry) =>
    r.username ? `@${r.username}` : [r.first_name, r.last_name].filter(Boolean).join(' ') || '—'

  return (
    <div style={s.root}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => setScreen('profile')}>←</button>
        <span style={s.title}>{t('referrals.title')}</span>
        <span style={s.count}>{total}</span>
      </div>

      {loading ? (
        <div style={s.loading}>{t('market.loading')}</div>
      ) : items.length === 0 ? (
        <div style={s.empty}>{t('referrals.empty')}</div>
      ) : (
        <div style={s.list}>
          {items.map((r, i) => {
            const color = LEVEL_COLORS[r.level] ?? '#64748b'
            return (
              <div key={i} style={s.row}>
                <span style={{ ...s.levelBadge, color, borderColor: color + '50', background: color + '12' }}>
                  {t('profile.levelN', { n: r.level })}
                </span>
                <span style={s.name}>{displayName(r)}</span>
                <span style={s.date}>{r.created_at.slice(0, 10)}</span>
              </div>
            )
          })}
        </div>
      )}

      {pages > 1 && (
        <div style={s.pagination}>
          <button
            style={{ ...s.pageBtn, ...(page <= 1 ? s.pageBtnDisabled : {}) }}
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ←
          </button>
          <span style={s.pageInfo}>{page} / {pages}</span>
          <button
            style={{ ...s.pageBtn, ...(page >= pages ? s.pageBtnDisabled : {}) }}
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root:    { display: 'flex', flexDirection: 'column', height: '100%', background: '#090c12', color: '#e0e0e0', fontFamily: 'monospace', overflow: 'hidden' },
  header:  { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 12px', borderBottom: '1px solid #1e293b', flexShrink: 0 },
  backBtn: { background: 'none', border: 'none', color: '#94a3b8', fontSize: 18, cursor: 'pointer', padding: '0 6px' },
  title:   { fontSize: 17, fontWeight: 700, color: '#e2e8f0', letterSpacing: 1, flex: 1 },
  count:   { fontSize: 13, color: '#64748b', background: 'rgba(255,255,255,0.05)', padding: '2px 10px', borderRadius: 10 },
  loading: { padding: 32, textAlign: 'center', color: '#475569', fontSize: 13 },
  empty:   { padding: 32, textAlign: 'center', color: '#475569', fontSize: 13 },
  list:    { flex: 1, overflowY: 'auto', padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 6 },
  row:     { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' },
  levelBadge: { fontSize: 10, fontWeight: 700, border: '1px solid', borderRadius: 6, padding: '2px 8px', flexShrink: 0, letterSpacing: 0.5 },
  name:    { flex: 1, fontSize: 13, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  date:    { fontSize: 11, color: '#475569', flexShrink: 0 },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '12px 16px', borderTop: '1px solid #1e293b', flexShrink: 0 },
  pageBtn:    { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', width: 36, height: 36, cursor: 'pointer', fontSize: 16 },
  pageBtnDisabled: { opacity: 0.3, cursor: 'not-allowed' },
  pageInfo: { fontSize: 13, color: '#94a3b8' },
}
