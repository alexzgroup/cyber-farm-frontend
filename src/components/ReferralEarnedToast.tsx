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

  return (
    <div className={styles.toast} onClick={() => setToast(null)} style={{ cursor: 'pointer' }}>
      <span style={{ fontSize: 20 }}>🎁</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#22d3ee' }}>
          {t('referrals.earnedToast', { amount: toast.amount.toFixed(4), name: toast.name })}
        </span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
          {t('referrals.earnedToastTotal', { total: toast.total.toFixed(4) })}
        </span>
      </div>
    </div>
  )
}
