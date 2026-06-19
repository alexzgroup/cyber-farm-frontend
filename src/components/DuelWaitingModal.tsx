import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { cancelDuelChallenge } from '../api'

export function DuelWaitingModal() {
  const { t } = useTranslation()
  const duelWaiting     = useGameStore((s) => s.duelWaiting)
  const pendingConfig   = useGameStore((s) => s.pendingDuelConfig)
  const duelDeclined    = useGameStore((s) => s.duelDeclined)
  const clearDuel       = useGameStore((s) => s.clearDuel)
  const clearDeclined   = useGameStore((s) => s.clearDuelDeclined)

  const [timeLeft, setTimeLeft] = useState(29)

  useEffect(() => {
    if (!duelWaiting) return
    const remaining = Math.max(0, Math.round((duelWaiting.expiresAt - Date.now()) / 1000))
    setTimeLeft(remaining)
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearDuel(); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [duelWaiting, clearDuel])

  // ── Declined notification ────────────────────────────────────────────────
  if (duelDeclined) {
    return (
      <div style={styles.overlay}>
        <div style={{ ...styles.modal, borderColor: '#ff4444', background: '#1a0000' }}>
          <div style={styles.icon}>❌</div>
          <div style={styles.title}>{t('duel.declinedTitle')}</div>
          <div style={styles.sub}>{t('duel.declinedSub')}</div>
          <button style={styles.btn} onClick={clearDeclined}>
            {t('duel.backToLobby')}
          </button>
        </div>
      </div>
    )
  }

  if (!duelWaiting) return null

  // Bet + prize info from pendingConfig
  const bet      = pendingConfig?.betAmount ?? 0
  const currency = pendingConfig?.currency ?? 'gold'
  const prize    = +(bet * 2 * 0.95).toFixed(currency === 'ton' ? 2 : 0)
  const sym      = currency === 'ton' ? '◈' : '⬡'
  const betLabel   = `${sym} ${bet}`
  const prizeLabel = `${sym} ${prize}`

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Spinner */}
        <div style={styles.spinner}>
          <div style={styles.spinnerRing} />
        </div>

        <div style={styles.title}>{t('duel.waitingTitle')}</div>
        <div style={styles.sub}>
          {t('duel.waitingFor', { name: duelWaiting.opponentName })}
        </div>

        {/* Bet / prize — same info as defender sees */}
        {bet > 0 && (
          <div style={styles.betBox}>
            <div style={styles.betRow}>
              <span style={styles.betKey}>{t('duel.betLabel')}</span>
              <span style={styles.betVal}>{betLabel}</span>
            </div>
            <div style={styles.betRow}>
              <span style={styles.betKey}>{t('duel.prizeLabel')}</span>
              <span style={{ ...styles.betVal, color: '#39ff14' }}>{prizeLabel}</span>
            </div>
            <div style={styles.commission}>{t('duel.commissionNote')}</div>
          </div>
        )}

        <div style={styles.timer}>{timeLeft}{t('duel.sec')}</div>

        <button
          style={{ ...styles.btn, background: '#1e293b', color: '#94a3b8' }}
          onClick={() => {
            cancelDuelChallenge(duelWaiting.duelId).catch(() => {/* silent */})
            clearDuel()
          }}
        >
          {t('duel.cancelChallenge')}
        </button>
      </div>

      <style>{`
        @keyframes duelSpin {
          to { transform: rotate(360deg) }
        }
      `}</style>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 200,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.82)',
  },
  modal: {
    background: '#0f172a', border: '1px solid #334155',
    borderRadius: 16, padding: '24px 20px',
    width: 300, display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 12, fontFamily: 'monospace',
  },
  spinner: {
    width: 52, height: 52, position: 'relative',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  spinnerRing: {
    width: 48, height: 48, borderRadius: '50%',
    border: '3px solid rgba(0,229,255,0.15)',
    borderTopColor: '#00e5ff',
    animation: 'duelSpin 0.9s linear infinite',
    position: 'absolute',
  },
  icon:  { fontSize: 44 },
  title: { fontSize: 16, fontWeight: 700, color: '#e2e8f0', letterSpacing: 1 },
  sub:   { fontSize: 13, color: '#64748b', textAlign: 'center' },
  betBox: {
    width: '100%', background: '#1e293b', borderRadius: 10,
    padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6,
  },
  betRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  betKey: { fontSize: 12, color: '#64748b' },
  betVal: { fontSize: 14, fontWeight: 700, color: '#f59e0b' },
  commission: { fontSize: 10, color: '#475569', marginTop: 2 },
  timer: {
    fontSize: 28, fontWeight: 900, color: '#f59e0b',
    letterSpacing: 2, lineHeight: 1,
  },
  btn: {
    width: '100%', padding: '11px', borderRadius: 8,
    background: '#dc2626', border: 'none', color: '#fff',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
}
