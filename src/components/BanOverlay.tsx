import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

function format(remainingMs: number): string {
  const s = Math.max(0, Math.ceil(remainingMs / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

// Full-screen overlay shown over Raids when the user has been auto-banned for
// suspicious raid burst patterns. Displays a countdown to ban expiry plus a
// short policy line so the user understands what to do.
export function BanOverlay({ bannedUntilMs, reason }: { bannedUntilMs: number; reason: string }) {
  const { t } = useTranslation()
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const remaining = bannedUntilMs - now
  if (remaining <= 0) return null

  return (
    <div style={s.wrap} role="dialog" aria-modal="true">
      <div style={s.card}>
        <div style={s.icon} aria-hidden="true">⛔</div>
        <h2 style={s.title}>{t('ban.title')}</h2>
        <p style={s.text}>{t('ban.text')}</p>
        <div style={s.timer}>{format(remaining)}</div>
        <p style={s.reason}>{t('ban.reason', { reason: reason || t('ban.reasonAuto') })}</p>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'absolute', inset: 0,
    background: 'rgba(13,17,23,0.92)',
    backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 80, padding: 24,
  },
  card: {
    maxWidth: 360, width: '100%',
    padding: '22px 22px 18px',
    borderRadius: 16,
    background: 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(127,29,29,0.22))',
    border: '1px solid rgba(239,68,68,0.55)',
    boxShadow: '0 10px 40px rgba(239,68,68,0.25)',
    color: '#fee2e2', fontFamily: 'monospace', textAlign: 'center',
  },
  icon:  { fontSize: 38, marginBottom: 6 },
  title: { fontSize: 17, fontWeight: 800, color: '#fecaca', letterSpacing: 0.4, margin: '0 0 8px' },
  text:  { fontSize: 12, color: '#fda4af', lineHeight: 1.4, margin: '0 0 14px' },
  timer: {
    fontSize: 34, fontWeight: 800, fontFamily: 'monospace',
    color: '#fff', letterSpacing: 2,
    textShadow: '0 0 16px rgba(239,68,68,0.6)',
    margin: '0 0 10px',
  },
  reason:{ fontSize: 10, color: '#94a3b8', margin: 0 },
}
