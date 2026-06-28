import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'

// Burst-gate modal: shown when the server demands a captcha after >=10 raids in
// the last minute. The challenge is server-issued (math problem); on submit we
// call store.executeRaid again with the answer, which embeds {captcha_id, answer}
// into the next raid POST.
export function CaptchaModal() {
  const { t } = useTranslation()
  const pending     = useGameStore((s) => s.pendingCaptcha)
  const executeRaid = useGameStore((s) => s.executeRaid)
  const dismiss     = useGameStore((s) => s.dismissCaptcha)
  const [answer, setAnswer] = useState('')
  const [busy,   setBusy]   = useState(false)
  const [bad,    setBad]    = useState(false)

  if (!pending) return null

  const submit = async () => {
    if (busy || !answer.trim()) return
    setBusy(true); setBad(false)
    const result = await executeRaid(pending.defenderId, answer.trim())
    setBusy(false)
    if (result === null && useGameStore.getState().pendingCaptcha) {
      // Server rejected the answer; new challenge already fetched into store.
      setAnswer(''); setBad(true)
    }
  }

  return (
    <div style={s.backdrop} onClick={dismiss}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={s.title}>🛡️ {t('captcha.title')}</h3>
        <p  style={s.subtitle}>{t('captcha.subtitle')}</p>
        <div style={s.question}>{pending.question}</div>
        <input
          autoFocus
          type="number"
          inputMode="numeric"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          style={{ ...s.input, ...(bad ? s.inputBad : {}) }}
          placeholder="?"
        />
        {bad && <div style={s.errorLine}>{t('captcha.wrong')}</div>}
        <div style={s.row}>
          <button style={s.cancel} onClick={dismiss}>{t('captcha.cancel')}</button>
          <button style={{ ...s.submit, ...(busy ? s.submitDisabled : {}) }} onClick={submit} disabled={busy || !answer.trim()}>
            {busy ? '…' : t('captcha.submit')}
          </button>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 },
  modal: { width: '88%', maxWidth: 320, background: '#0d1117', border: '1px solid rgba(56,189,248,0.4)', borderRadius: 14, padding: '20px 22px', color: '#e2e8f0', fontFamily: 'monospace' },
  title: { fontSize: 15, fontWeight: 800, color: '#22d3ee', margin: '0 0 6px', letterSpacing: 0.4 },
  subtitle: { fontSize: 11, color: '#94a3b8', margin: '0 0 14px', lineHeight: 1.4 },
  question: { fontSize: 26, fontWeight: 800, textAlign: 'center', letterSpacing: 1, padding: '14px 0', color: '#fff' },
  input: { width: '100%', padding: '12px', borderRadius: 10, border: '1px solid rgba(56,189,248,0.4)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 18, textAlign: 'center', fontFamily: 'monospace', outline: 'none' },
  inputBad: { borderColor: '#ef4444', boxShadow: '0 0 0 2px rgba(239,68,68,0.25)' },
  errorLine: { fontSize: 11, color: '#fca5a5', marginTop: 6, textAlign: 'center' },
  row: { display: 'flex', gap: 8, marginTop: 14 },
  cancel: { flex: 1, padding: 10, borderRadius: 10, border: '1px solid rgba(148,163,184,0.3)', background: 'transparent', color: '#94a3b8', fontFamily: 'monospace', fontSize: 12, cursor: 'pointer' },
  submit: { flex: 2, padding: 10, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#38bdf8,#a855f7)', color: '#0d1117', fontWeight: 800, fontFamily: 'monospace', fontSize: 13, cursor: 'pointer', letterSpacing: 0.5 },
  submitDisabled: { opacity: 0.55, cursor: 'wait' },
}
