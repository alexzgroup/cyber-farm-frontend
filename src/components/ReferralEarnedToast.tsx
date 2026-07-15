import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import styles from './TonDepositToast.module.css'

export function ReferralEarnedToast() {
  const { t }    = useTranslation()
  const toast    = useGameStore((s) => s.referralEarnedToast)
  const setToast = useGameStore((s) => s.setReferralEarnedToast)

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(id)
  }, [toast, setToast])

  if (!toast) return null

  const isGold = toast.currency === 'gold'
  const amountText = isGold ? Math.round(toast.amount).toString() : toast.amount.toFixed(4)
  const totalText  = toast.total.toFixed(4)

  return (
    <div className={styles.toast} onClick={() => setToast(null)} style={{ cursor: 'pointer' }}>
      <span style={{ fontSize: 20 }}>{isGold ? '🪙' : '🎁'}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#22d3ee' }}>
          {isGold
            ? t('referrals.earnedToastGold', { amount: amountText, name: toast.name })
            : t('referrals.earnedToast',     { amount: amountText, name: toast.name })}
        </span>
        {!isGold && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
            {t('referrals.earnedToastTotal', { total: totalText })}
          </span>
        )}
      </div>
    </div>
  )
}
