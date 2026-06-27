import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getDailyBonusStatus, claimDailyBonus } from '../api'
import { useGameStore } from '../store/gameStore'
import type { DailyBonusStatus } from '../api/types'

/**
 * Авто-показывается при старте приложения если daily-bonus claimable=true.
 * Один раз за сессию — затем сама закрывается после клейма или закрытия.
 */
export function DailyBonusModal() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<DailyBonusStatus | null>(null)
  const [open,   setOpen]   = useState(false)
  const [busy,   setBusy]   = useState(false)
  const loadGameState = useGameStore((s) => s.loadGameState)

  useEffect(() => {
    let mounted = true
    getDailyBonusStatus()
      .then((s) => {
        if (!mounted) return
        setStatus(s)
        if (s.claimable) setOpen(true)
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  if (!open || !status) return null

  const handleClaim = async () => {
    if (busy) return
    setBusy(true)
    try {
      const r = await claimDailyBonus()
      // Refresh user balance so the new gold/TON shows immediately
      loadGameState()
      // Update local view: mark as claimed
      setStatus((prev) => prev ? { ...prev, current_streak: r.streak, claimable: false } : prev)
      // Close after a beat
      setTimeout(() => setOpen(false), 1500)
    } catch {
      setBusy(false)
    }
  }

  return (
    <div style={s.backdrop} onClick={() => setOpen(false)}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <span style={s.title}>🎁 {t('daily.title')}</span>
          <button style={s.closeX} onClick={() => setOpen(false)} aria-label="close">×</button>
        </div>
        <p style={s.subtitle}>{t('daily.subtitle')}</p>

        <div style={s.grid}>
          {status.rewards.map((r) => {
            const isToday = r.day === status.next_streak && status.claimable
            const isClaimed = r.day < status.next_streak ||
                              (!status.claimable && r.day === status.current_streak)
            return (
              <div
                key={r.day}
                style={{
                  ...s.cell,
                  ...(isToday   ? s.cellToday   : {}),
                  ...(isClaimed ? s.cellClaimed : {}),
                }}
              >
                <div style={s.dayLabel}>{t('daily.day', { n: r.day })}</div>
                <div style={s.rewardValue}>
                  {r.ton ? <><span style={{ color: '#22d3ee' }}>◈ {r.ton}</span></>
                         : <>{r.gold} <span style={{ opacity: 0.55, fontSize: 10 }}>g</span></>}
                </div>
                {isClaimed && <div style={s.tag}>✓</div>}
                {isToday   && <div style={{ ...s.tag, background: 'rgba(34,211,238,0.25)' }}>{t('daily.today')}</div>}
              </div>
            )
          })}
        </div>

        <button
          style={{ ...s.claimBtn, ...(busy || !status.claimable ? s.claimBtnDisabled : {}) }}
          onClick={handleClaim}
          disabled={busy || !status.claimable}
        >
          {status.claimable
            ? (busy ? '…' : `${t('daily.claim')}`)
            : t('daily.comeBack')}
        </button>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 },
  modal:    { width: '92%', maxWidth: 380, background: '#0d1117', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 16, padding: '18px 20px', color: '#e2e8f0', fontFamily: 'monospace' },
  header:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  title:    { fontSize: 15, fontWeight: 700, color: '#22d3ee', letterSpacing: 0.5 },
  closeX:   { background: 'none', border: 'none', color: '#64748b', fontSize: 24, cursor: 'pointer', padding: '0 4px', lineHeight: 1 },
  subtitle: { fontSize: 12, color: '#94a3b8', margin: '0 0 14px', lineHeight: 1.4 },
  grid:     { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 14 },
  cell:     { position: 'relative', padding: '10px 6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, textAlign: 'center', minHeight: 60 },
  cellToday:   { background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.5)', boxShadow: '0 0 14px rgba(56,189,248,0.2)' },
  cellClaimed: { opacity: 0.45 },
  dayLabel: { fontSize: 10, color: '#64748b', marginBottom: 3 },
  rewardValue: { fontSize: 13, fontWeight: 700, color: '#e2e8f0' },
  tag:      { position: 'absolute', top: 3, right: 4, fontSize: 9, color: '#22d3ee', background: 'rgba(34,211,238,0.12)', padding: '1px 5px', borderRadius: 4 },
  claimBtn: { width: '100%', padding: '12px', border: 'none', borderRadius: 10, background: 'linear-gradient(135deg, rgba(56,189,248,0.3), rgba(168,85,247,0.25))', color: '#e0f2fe', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace', letterSpacing: 0.5 },
  claimBtnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
}
