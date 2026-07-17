import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import styles from './TonDepositToast.module.css'

// DuelVerdictToast surfaces the three non-normal outcomes of the two-phase
// duel verdict flow that pure balance-refresh doesn't communicate on its own:
//
//   awaiting — first submit landed, waiting for the opponent's confirmation.
//              Escrow still held. Shown briefly so the winning client knows
//              their result was accepted and payout hinges on the other side.
//   disputed — participants declared different winners; escrow refunded.
//   abandoned — opponent never submitted within the grace window; refunded.
//
// Auto-dismiss after 6s to match the other toasts. Balance refresh happens
// separately in the WS handler (loadGameState), so this component is purely
// informational.
export function DuelVerdictToast() {
  const { t }    = useTranslation()
  const toast    = useGameStore((s) => s.duelVerdictToast)
  const setToast = useGameStore((s) => s.setDuelVerdictToast)

  useEffect(() => {
    if (!toast) return
    const timeout = toast.kind === 'awaiting' ? 4000 : 8000
    const id = setTimeout(() => setToast(null), timeout)
    return () => clearTimeout(id)
  }, [toast, setToast])

  if (!toast) return null

  const currencyLabel = toast.currency === 'ton' ? 'GRAM' : '⬡'
  const refundText = toast.refund != null
    ? `${toast.currency === 'ton' ? toast.refund.toFixed(4) : Math.round(toast.refund)} ${currencyLabel}`
    : ''

  let icon = '⏳'
  let title = ''
  let sub: string | null = null

  switch (toast.kind) {
    case 'awaiting':
      icon  = '⏳'
      title = t('duel.verdictAwaiting')
      break
    case 'disputed':
      icon  = '⚖️'
      title = t('duel.verdictDisputed')
      sub   = refundText ? t('duel.verdictRefund', { amount: refundText }) : null
      break
    case 'abandoned':
      icon  = '🕒'
      title = t('duel.verdictAbandoned')
      sub   = refundText ? t('duel.verdictRefund', { amount: refundText }) : null
      break
  }

  return (
    <div className={styles.toast} onClick={() => setToast(null)} style={{ cursor: 'pointer' }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#22d3ee' }}>
          {title}
        </span>
        {sub && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  )
}
