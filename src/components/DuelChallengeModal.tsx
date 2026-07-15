import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { totalPower, powerTier } from '../utils/duelPower'

const ACCEPT_TIMEOUT_SEC = 28

export function DuelChallengeModal() {
  const { t } = useTranslation()
  const challenge    = useGameStore((s) => s.pendingDuelChallenge)
  const acceptDuel   = useGameStore((s) => s.acceptDuelChallenge)
  const declineDuel  = useGameStore((s) => s.declineDuelChallenge)
  const drones       = useGameStore((s) => s.drones)
  const unitUpgrades = useGameStore((s) => s.unitUpgrades)
  const [timeLeft, setTimeLeft] = useState(ACCEPT_TIMEOUT_SEC)

  useEffect(() => {
    if (!challenge) return
    setTimeLeft(ACCEPT_TIMEOUT_SEC)
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { declineDuel(); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [challenge, declineDuel])

  if (!challenge) return null

  const myPower  = totalPower(drones, unitUpgrades)
  const oppPower = challenge.challenger_power ?? 0
  const maxPow   = Math.max(myPower, oppPower, 1)
  const myTier   = powerTier(myPower)
  const oppTier  = powerTier(oppPower)
  const diff     = oppPower - myPower

  const sym      = challenge.currency === 'ton' ? '◈' : '⬡'
  const prize    = (challenge.bet_amount * 2 * 0.75).toFixed(challenge.currency === 'ton' ? 2 : 0)

  const timerPct = (timeLeft / ACCEPT_TIMEOUT_SEC) * 100

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Timer bar at top */}
        <div style={styles.timerBar}>
          <div style={{ ...styles.timerFill, width: `${timerPct}%`, background: timeLeft < 8 ? '#dc2626' : '#00e5ff' }} />
        </div>

        <div style={styles.timerRow}>
          <span style={styles.icon}>⚔️</span>
          <span style={styles.title}>{t('duel.challengeIncoming')}</span>
          <span style={{ ...styles.timerNum, color: timeLeft < 8 ? '#dc2626' : '#94a3b8' }}>{timeLeft}с</span>
        </div>

        {/* Challenger name */}
        <div style={styles.challenger}>
          <span style={styles.challengerName}>{challenge.challenger_name}</span>
          <span style={styles.challengerSub}>{t('duel.challengesYou')}</span>
        </div>

        {/* Power comparison */}
        <div style={styles.powerBox}>
          {/* Opponent */}
          <div style={styles.powerSide}>
            <div style={{ ...styles.powerTier, color: oppTier.color }}>{oppTier.label}</div>
            <div style={{ ...styles.powerVal, color: oppTier.color }}>{oppPower}</div>
            <div style={styles.powerBarTrack}>
              <div style={{ ...styles.powerBarFill, width: `${(oppPower / maxPow) * 100}%`, background: oppTier.color }} />
            </div>
            <div style={styles.powerWho}>{challenge.challenger_name.split(' ')[0]}</div>
          </div>

          {/* VS divider */}
          <div style={styles.vsBlock}>
            <div style={styles.vsText}>VS</div>
            <div style={{ ...styles.vsDiff, color: diff > 0 ? '#ff4444' : diff < 0 ? '#4ade80' : '#94a3b8' }}>
              {diff > 0 ? `+${diff}` : diff === 0 ? '=' : `${diff}`}
            </div>
          </div>

          {/* My power */}
          <div style={{ ...styles.powerSide, alignItems: 'flex-end' }}>
            <div style={{ ...styles.powerTier, color: myTier.color }}>{myTier.label}</div>
            <div style={{ ...styles.powerVal, color: myTier.color }}>{myPower}</div>
            <div style={{ ...styles.powerBarTrack, transform: 'scaleX(-1)' }}>
              <div style={{ ...styles.powerBarFill, width: `${(myPower / maxPow) * 100}%`, background: myTier.color }} />
            </div>
            <div style={styles.powerWho}>{t('duel.you')}</div>
          </div>
        </div>

        {/* Bet / prize */}
        <div style={styles.betBox}>
          <div style={styles.betRow}>
            <span style={styles.betKey}>{t('duel.betLabel')}</span>
            <span style={styles.betVal}>{sym} {challenge.bet_amount}</span>
          </div>
          <div style={styles.betRow}>
            <span style={styles.betKey}>{t('duel.prizeLabel')}</span>
            <span style={{ ...styles.betVal, color: '#39ff14' }}>{sym} {prize}</span>
          </div>
          <div style={styles.commission}>{t('duel.commissionNote')}</div>
        </div>

        {/* Buttons */}
        <div style={styles.buttons}>
          <button style={styles.declineBtn} onClick={declineDuel}>{t('duel.decline')}</button>
          <button style={styles.acceptBtn}  onClick={acceptDuel}>{t('duel.accept')}</button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 200,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.85)',
  },
  modal: {
    background: '#0f172a', border: '1px solid #1e293b',
    borderRadius: 18, width: 310, overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    fontFamily: 'monospace', boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
  },
  timerBar: { height: 3, background: '#1e293b' },
  timerFill: { height: '100%', transition: 'width 1s linear, background 0.3s' },
  timerRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px 4px' },
  icon:     { fontSize: 22 },
  title:    { flex: 1, fontSize: 14, fontWeight: 700, color: '#e2e8f0', letterSpacing: 0.5 },
  timerNum: { fontSize: 13, fontWeight: 700 },
  challenger: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '4px 16px 10px', gap: 1,
  },
  challengerName: { fontSize: 22, fontWeight: 900, color: '#06b6d4', letterSpacing: 0.5 },
  challengerSub:  { fontSize: 11, color: '#475569' },

  // Power comparison
  powerBox: {
    display: 'flex', alignItems: 'stretch', gap: 0,
    margin: '0 12px 10px', background: '#0a1628',
    borderRadius: 12, padding: '12px 10px', border: '1px solid #1e293b',
  },
  powerSide: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' },
  powerTier: { fontSize: 9, fontWeight: 900, letterSpacing: 1.5 },
  powerVal:  { fontSize: 22, fontWeight: 900, lineHeight: '1' },
  powerBarTrack: { width: '100%', height: 5, background: '#1e293b', borderRadius: 3, overflow: 'hidden' },
  powerBarFill:  { height: '100%', borderRadius: 3, transition: 'width 0.5s ease' },
  powerWho:  { fontSize: 10, color: '#475569' },
  vsBlock:   { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '0 10px' },
  vsText:    { fontSize: 11, color: '#334155', fontWeight: 700 },
  vsDiff:    { fontSize: 13, fontWeight: 900 },

  // Bet
  betBox: {
    margin: '0 12px 12px', background: '#1e293b', borderRadius: 10,
    padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6,
  },
  betRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  betKey:   { fontSize: 12, color: '#64748b' },
  betVal:   { fontSize: 14, fontWeight: 700, color: '#f59e0b' },
  commission: { fontSize: 10, color: '#475569', marginTop: 2 },

  buttons:    { display: 'flex', gap: 0 },
  declineBtn: { flex: 1, padding: '14px', background: '#1e293b', border: 'none', borderTop: '1px solid #334155', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer', borderBottomLeftRadius: 18 },
  acceptBtn:  { flex: 2, padding: '14px', background: 'linear-gradient(135deg,#059669,#047857)', border: 'none', borderTop: '1px solid #334155', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', borderBottomRightRadius: 18 },
}
