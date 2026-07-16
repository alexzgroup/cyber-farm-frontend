import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { getFavorites, removeFavorite } from '../api'
import { Avatar } from '../components/Avatar'
import { HeartButton } from '../components/HeartButton'
import { useCountdown, fmtCooldown } from '../hooks/useCooldown'
import type { ApiFavorite } from '../api/types'

function FavoriteRow({ item, onRemove }: { item: ApiFavorite; onRemove: (id: number) => void }) {
  const { t }       = useTranslation()
  const setScreen   = useGameStore((s) => s.setScreen)
  const setPendingRaidTarget = useGameStore((s) => s.setPendingRaidTarget)
  const setPendingDuelTarget = useGameStore((s) => s.setPendingDuelTarget)
  const drones      = useGameStore((s) => s.drones)

  const remaining = useCountdown(item.cooldown_until)
  const onCooldown = remaining > 0
  const workingDrones = drones.filter((d) => !d.isBroken)
  const noDrones = workingDrones.length === 0
  const raidDisabled = onCooldown || noDrones

  const displayName = item.username ? `@${item.username}` : [item.first_name, item.last_name].filter(Boolean).join(' ') || '—'

  const handleRaid = () => {
    if (raidDisabled) return
    setPendingRaidTarget(item.id)
    setScreen('raids')
  }

  const handleDuel = () => {
    setPendingDuelTarget(item.id)
    setScreen('duel')
  }

  return (
    <div style={s.row}>
      <Avatar url={item.avatar_url} firstName={item.first_name} lastName={item.last_name} username={item.username} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={s.name}>
          <span style={{
            display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
            background: item.is_online ? '#39ff14' : '#ef4444',
            marginRight: 6, flexShrink: 0, verticalAlign: 'middle',
            boxShadow: item.is_online ? '0 0 4px #39ff14' : undefined,
          }} />
          {displayName}
        </div>
        <div style={s.date}>{item.added_at.slice(0, 10)}</div>
      </div>

      <button style={s.duelBtn} onClick={handleDuel} title={t('duel.title')}>
        ⚔️
      </button>

      <button
        style={{ ...s.raidBtn, ...(raidDisabled ? s.raidDisabled : {}) }}
        onClick={handleRaid}
        disabled={raidDisabled}
        title={onCooldown ? fmtCooldown(remaining) : t('raids.attack')}
      >
        {onCooldown ? <span style={s.cdText}>{fmtCooldown(remaining)}</span> : '💥'}
      </button>

      <HeartButton active onClick={() => onRemove(item.id)} title={t('favorites.remove')} size={36} />
    </div>
  )
}

export function FavoritesScreen() {
  const { t }     = useTranslation()
  const setScreen = useGameStore((s) => s.setScreen)

  const [items, setItems]     = useState<ApiFavorite[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getFavorites()
      .then((data) => setItems(data.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const handleRemove = async (id: number) => {
    await removeFavorite(id)
    setItems((prev) => prev.filter((x) => x.id !== id))
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => setScreen('profile')}>←</button>
        <span style={s.title}>{t('favorites.title')}</span>
        <span style={s.count}>{items.length}</span>
      </div>

      {loading ? (
        <div style={s.empty}>{t('market.loading')}</div>
      ) : items.length === 0 ? (
        <div style={s.empty}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>💔</div>
          <div style={{ fontSize: 14, color: '#94a3b8' }}>{t('favorites.empty')}</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 6, maxWidth: 280 }}>
            {t('favorites.emptyHint')}
          </div>
        </div>
      ) : (
        <div style={s.list}>
          {items.map((r) => (
            <FavoriteRow key={r.id} item={r} onRemove={handleRemove} />
          ))}
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
  count:   { fontSize: 13, color: '#ff3d7f', background: 'rgba(255,61,127,0.1)', padding: '2px 10px', borderRadius: 10 },
  empty:   { padding: 40, textAlign: 'center', color: '#475569', fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'center' },
  list:    { flex: 1, overflowY: 'auto', padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 6 },
  row:     { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' },
  name:    { fontSize: 13, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  date:    { fontSize: 11, color: '#475569' },

  duelBtn: {
    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
    background: 'linear-gradient(135deg, rgba(0,229,255,0.18), rgba(0,229,255,0.06))',
    border: '1px solid rgba(0,229,255,0.35)',
    color: '#00e5ff', cursor: 'pointer', fontSize: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0,
  },
  raidBtn: {
    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
    background: 'linear-gradient(135deg, #ff222244, #ff444466)',
    border: '1px solid #ff444466',
    color: '#e6edf3', cursor: 'pointer', fontSize: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0,
  },
  raidDisabled: {
    background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
    borderColor: '#334',
    color: '#6b7db3',
    cursor: 'not-allowed',
  },
  cdText: { fontSize: 9, fontWeight: 700, letterSpacing: 0.3 },
}
