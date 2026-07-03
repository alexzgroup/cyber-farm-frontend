import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { PvPHeader } from '../components/PvPHeader'
import { HeartButton } from '../components/HeartButton'
import { totalPower, powerTier } from '../utils/duelPower'
import * as api from '../api'
import type { ApiDuelPlayer } from '../api/types'

export function DuelScreen() {
  const { t } = useTranslation()
  const setScreen        = useGameStore((s) => s.setScreen)
  const balance          = useGameStore((s) => s.balance)
  const tonBalance       = useGameStore((s) => s.tonBalance)
  const drones           = useGameStore((s) => s.drones)
  const unitUpgrades     = useGameStore((s) => s.unitUpgrades)
  const allowDuel        = useGameStore((s) => s.allowDuel)
  const onlineStatus     = useGameStore((s) => s.onlineStatus)
  const updateDuelSettings = useGameStore((s) => s.updateDuelSettings)
  const startDuel        = useGameStore((s) => s.startDuelWithPlayer)

  const PLAYERS_PER_PAGE = 8

  const [players, setPlayers]         = useState<ApiDuelPlayer[]>([])
  const [loading, setLoading]         = useState(true)
  const [selectedId, setSelectedId]   = useState<number | null>(null)
  const [betAmount, setBetAmount]     = useState('')
  const [currency, setCurrency]       = useState<'gold' | 'ton'>('gold')
  const [challenging, setChallenging] = useState(false)
  const [error, setError]             = useState('')
  const [page, setPage]               = useState(0)
  const [search, setSearch]           = useState('')

  // Can the current user afford to challenge anyone?
  const amount     = Number(betAmount) || 0
  const canAfford  = amount <= 0
    || (currency === 'gold' && balance >= amount)
    || (currency === 'ton'  && tonBalance >= amount)

  const myPower = totalPower(drones, unitUpgrades)
  const myTier  = powerTier(myPower)

  useEffect(() => {
    const trimmed = search.trim()
    if (trimmed.length === 1) return
    setLoading(true)
    const handle = setTimeout(() => {
      api.getDuelPlayers(trimmed.length >= 2 ? trimmed : undefined)
        .then(setPlayers)
        .catch(() => setPlayers([]))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(handle)
  }, [search])

  const pagedPlayers   = players.slice(page * PLAYERS_PER_PAGE, (page + 1) * PLAYERS_PER_PAGE)
  const totalPages     = Math.ceil(players.length / PLAYERS_PER_PAGE)
  const selectedPlayer = players.find((p) => p.id === selectedId)

  const handleToggleFavorite = async (id: number, current: boolean) => {
    setPlayers((prev) => prev.map((p) => p.id === id ? { ...p, is_favorite: !current } : p))
    try {
      if (current) await api.removeFavorite(id)
      else         await api.addFavorite(id)
    } catch {
      setPlayers((prev) => prev.map((p) => p.id === id ? { ...p, is_favorite: current } : p))
    }
  }

  const handleChallenge = async () => {
    if (!selectedPlayer || !betAmount || Number(betAmount) <= 0) return
    setError('')
    const amount = Number(betAmount)
    if (currency === 'gold' && balance < amount) { setError(t('duel.insufficientGold')); return }
    if (currency === 'ton'  && tonBalance < amount) { setError(t('duel.insufficientTon')); return }

    setChallenging(true)
    try {
      await startDuel(selectedPlayer, amount, currency)
      setSelectedId(null)
      setBetAmount('')
    } catch (e: unknown) {
      const msg = (e as Error).message ?? ''
      if (msg.includes('opponent has insufficient')) setError(t('duel.opponentInsufficient'))
      else if (msg.includes('opponent') || msg.includes('defender')) setError(t('duel.opponentBusy'))
      else if (msg.includes('already')) setError(t('duel.youBusy'))
      else setError(t('duel.errorChallenge'))
    } finally {
      setChallenging(false)
    }
  }

  // ── Stub: duel disabled ──────────────────────────────────────────────────────
  if (!allowDuel) {
    return (
      <div style={s.root}>
        <PvPHeader activeTab="duel" onHistory={() => setScreen('duel-history')} />
        <div style={s.stub}>
          <div style={s.stubIcon}>🔕</div>
          <div style={s.stubTitle}>{t('duel.disabledTitle')}</div>
          <div style={s.stubSub}>{t('duel.disabledSub')}</div>
          <button style={s.stubBtn} onClick={() => updateDuelSettings(true)}>{t('duel.enableDuels')}</button>
        </div>
      </div>
    )
  }

  const maxPower = Math.max(myPower, ...players.map((p) => p.power ?? 0), 1)

  return (
    <div style={s.root}>
      <PvPHeader activeTab="duel" onHistory={() => setScreen('duel-history')} />

      {/* MY POWER panel */}
      <div style={s.myPowerBox}>
        <div style={s.myPowerLeft}>
          <div style={{ ...s.tierBadge, color: myTier.color, borderColor: myTier.color + '60' }}>
            {myTier.label}
          </div>
          <div style={s.myPowerLabel}>{t('duel.myPower')}</div>
        </div>
        <div style={s.myPowerRight}>
          <div style={{ ...s.myPowerNum, color: myTier.color }}>{myPower}</div>
          <div style={s.myPowerBar}>
            <div style={{ ...s.myPowerFill, width: `${(myPower / maxPower) * 100}%`, background: myTier.color }} />
          </div>
        </div>
      </div>

      {/* Bet config */}
      <div style={s.betBox}>
        <div style={s.betRow}>
          <span style={s.betLabel}>{t('duel.bet')}</span>
          <input
            style={s.betInput}
            type="number" min="1"
            placeholder={t('duel.betPlaceholder')}
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
          />
          <div style={s.currencyToggle}>
            <button style={{ ...s.currBtn, ...(currency === 'gold' ? s.currActive    : {}) }} onClick={() => setCurrency('gold')}>⬡ Золото</button>
            <button style={{ ...s.currBtn, ...(currency === 'ton'  ? s.currActiveTon : {}) }} onClick={() => setCurrency('ton') }>◈ TON</button>
          </div>
        </div>
        {error && <div style={s.error}>{error}</div>}
      </div>

      {/* Player list */}
      <div style={s.listLabel}>{t('duel.chooseFoe')}</div>
      <input
        type="text"
        placeholder={t('search.placeholder')}
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0) }}
        style={s.searchInput}
      />
      {loading ? (
        <div style={s.loading}>{t('duel.loading')}</div>
      ) : (
        <div style={s.list}>
          {pagedPlayers.map((p) => {
            const pTier   = powerTier(p.power ?? 0)
            const isSelected = selectedId === p.id
            const powerPct   = ((p.power ?? 0) / maxPower) * 100
            const vs = (p.power ?? 0) - myPower
            const isOnline   = p.id in onlineStatus ? onlineStatus[p.id] : p.is_online
            const isOffline  = isOnline === false
            const opponentBroke = amount > 0 && (
              (currency === 'gold' && p.balance      < amount) ||
              (currency === 'ton'  && p.ton_balance  < amount)
            )
            const disabled = !canAfford || isOffline || opponentBroke
            return (
              <div
                key={p.id}
                style={{
                  ...s.card,
                  ...(isSelected ? s.cardSelected : {}),
                  ...(disabled ? s.cardDisabled : {}),
                }}
                onClick={() => !disabled && setSelectedId(p.id === selectedId ? null : p.id)}
              >
                {/* Avatar + name */}
                <div style={s.cardLeft}>
                  <div style={{ ...s.avatarBox, borderColor: pTier.color + '80', background: pTier.color + '15' }}>
                    {pTier.label === 'ELITE' ? '💎' : pTier.label === 'ADVANCED' ? '⚡' : pTier.label === 'SKILLED' ? '🤖' : pTier.label === 'ROOKIE' ? '🔧' : '📟'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={s.playerName}>
                      <span style={{
                        display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                        background: isOnline ? '#39ff14' : '#ef4444',
                        marginRight: 5, flexShrink: 0, verticalAlign: 'middle',
                        boxShadow: isOnline ? '0 0 4px #39ff14' : undefined,
                      }} />
                      {p.first_name || p.username}
                    </div>
                    <div style={s.playerBalance}>⬡ {Math.floor(p.balance).toLocaleString()}</div>
                    {p.ton_balance > 0 && (
                      <div style={s.playerTon}>◈ {p.ton_balance.toFixed(2)} TON</div>
                    )}
                  </div>
                </div>

                {/* Favorite toggle */}
                <HeartButton
                  active={!!p.is_favorite}
                  onClick={() => handleToggleFavorite(p.id, !!p.is_favorite)}
                  size={28}
                />

                {/* Power bar + tier */}
                <div style={s.cardRight}>
                  <div style={{ ...s.cardTier, color: pTier.color }}>{pTier.label}</div>
                  <div style={s.powerBarWrap}>
                    <div style={{ ...s.powerBarFill, width: `${powerPct}%`, background: pTier.color }} />
                  </div>
                  <div style={{ ...s.powerNum, color: pTier.color }}>{p.power ?? 0}</div>
                  {isSelected && (
                    <div style={{ ...s.vsDiff, color: vs >= 0 ? '#ff4444' : '#4ade80' }}>
                      {vs >= 0 ? `+${vs}` : `${vs}`}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div style={s.pagination}>
          <button style={{ ...s.pageBtn, ...(page === 0 ? s.pageBtnDisabled : {}) }} disabled={page === 0} onClick={() => setPage(p => p - 1)}>←</button>
          <span style={s.pageInfo}>{page + 1} / {totalPages}</span>
          <button style={{ ...s.pageBtn, ...(page >= totalPages - 1 ? s.pageBtnDisabled : {}) }} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>→</button>
        </div>
      )}

      <div style={s.notice}>{t('duel.commission')}</div>

      <button
        style={{ ...s.challengeBtn, ...(!selectedPlayer || !betAmount || !canAfford || challenging ? s.challengeBtnDisabled : {}) }}
        disabled={!selectedPlayer || !betAmount || !canAfford || challenging}
        onClick={handleChallenge}
      >
        {challenging
          ? t('duel.challenging')
          : selectedPlayer
            ? t('duel.challengePlayer', { name: selectedPlayer.first_name || selectedPlayer.username })
            : t('duel.selectPlayer')}
      </button>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root:  { display: 'flex', flexDirection: 'column', height: '100%', background: '#090c12', color: '#e0e0e0', fontFamily: 'monospace', overflow: 'hidden' },

  // My power panel
  myPowerBox: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 16px', background: 'rgba(14,165,233,0.07)',
    borderBottom: '1px solid rgba(14,165,233,0.15)', flexShrink: 0,
  },
  myPowerLeft:  { display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' },
  myPowerRight: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  tierBadge: { fontSize: 9, fontWeight: 900, letterSpacing: 1.5, border: '1px solid', borderRadius: 4, padding: '2px 6px' },
  myPowerLabel: { fontSize: 10, color: '#64748b' },
  myPowerNum:   { fontSize: 18, fontWeight: 900, letterSpacing: 1, lineHeight: '1' },
  myPowerBar:   { height: 4, background: '#1e293b', borderRadius: 2, overflow: 'hidden' },
  myPowerFill:  { height: '100%', borderRadius: 2, transition: 'width 0.6s ease' },

  // Bet
  betBox:   { padding: '8px 16px', flexShrink: 0 },
  betRow:   { display: 'flex', alignItems: 'center', gap: 10 },
  betLabel: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, flexShrink: 0 },
  currencyToggle: { display: 'flex', gap: 4, flexShrink: 0 },
  currBtn:       { background: 'transparent', border: '1px solid #334155', borderRadius: 6, padding: '6px 8px', fontSize: 11, color: '#64748b', cursor: 'pointer', whiteSpace: 'nowrap' },
  currActive:    { borderColor: '#f59e0b', color: '#f59e0b', background: 'rgba(245,158,11,0.12)' },
  currActiveTon: { borderColor: '#38bdf8', color: '#38bdf8', background: 'rgba(56,189,248,0.12)' },
  betInput: { flex: 1, minWidth: 0, background: '#111827', border: '1px solid #334155', borderRadius: 8, padding: '7px 10px', color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box' },
  error:    { fontSize: 11, color: '#f87171', marginTop: 6 },

  // List
  listLabel: { padding: '8px 16px 4px', fontSize: 10, color: '#475569', letterSpacing: 1.5, textTransform: 'uppercase', flexShrink: 0 },
  searchInput: { margin: '0 16px 8px', padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#e0e0e0', fontSize: 13, outline: 'none', flexShrink: 0 } as React.CSSProperties,
  loading:   { padding: 20, textAlign: 'center', color: '#475569', fontSize: 13 },
  list:      { flex: 1, overflowY: 'auto', padding: '4px 12px 8px', display: 'flex', flexDirection: 'column', gap: 6 },

  card: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', borderRadius: 12,
    background: '#111820', border: '1px solid rgba(255,255,255,0.06)',
    cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
  },
  cardSelected: { background: 'rgba(0,229,255,0.07)', borderColor: 'rgba(0,229,255,0.35)' },
  cardDisabled: { opacity: 0.35, cursor: 'not-allowed' },
  cardLeft:  { display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  cardRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, minWidth: 80 },
  avatarBox: { width: 36, height: 36, borderRadius: 8, border: '1px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 },
  playerName:    { fontSize: 13, fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  playerBalance: { fontSize: 11, color: '#94a3b8' },
  playerTon:     { fontSize: 10, color: '#38bdf8' },
  cardTier:   { fontSize: 9, fontWeight: 900, letterSpacing: 1 },
  powerBarWrap: { width: 72, height: 4, background: '#1e293b', borderRadius: 2, overflow: 'hidden' },
  powerBarFill: { height: '100%', borderRadius: 2, transition: 'width 0.4s ease' },
  powerNum:   { fontSize: 11, fontWeight: 700 },
  vsDiff:     { fontSize: 11, fontWeight: 900 },
  tonBadge:   { fontSize: 10, color: '#38bdf8' },
  selected:   { fontSize: 16, color: '#00e5ff' },

  pagination:      { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '6px 16px', flexShrink: 0 },
  pageBtn:         { background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#94a3b8', fontSize: 14, padding: '4px 12px', cursor: 'pointer' },
  pageBtnDisabled: { opacity: 0.3, cursor: 'not-allowed' },
  pageInfo:        { fontSize: 12, color: '#64748b' },

  notice: { padding: '3px 16px', fontSize: 9, color: '#334155', textAlign: 'center', flexShrink: 0 },
  challengeBtn: { margin: '4px auto 10px', padding: '10px 28px', borderRadius: 10, background: 'linear-gradient(135deg, #dc2626, #b91c1c)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5, flexShrink: 0, display: 'block', maxWidth: 280, width: 'auto' },
  challengeBtnDisabled: { background: '#1e293b', color: '#475569', cursor: 'not-allowed' },

  stub: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '32px 24px' },
  stubIcon:  { fontSize: 52 },
  stubTitle: { fontSize: 17, fontWeight: 700, color: '#e2e8f0', textAlign: 'center' },
  stubSub:   { fontSize: 13, color: '#64748b', textAlign: 'center', maxWidth: 260 },
  stubBtn:   { marginTop: 8, padding: '11px 28px', borderRadius: 10, background: 'linear-gradient(135deg, #059669, #065f46)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
}
