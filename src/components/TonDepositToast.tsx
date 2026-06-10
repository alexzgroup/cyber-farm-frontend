import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import styles from './TonDepositToast.module.css'

export function TonDepositToast() {
  const toast    = useGameStore((s) => s.tonDepositToast)
  const setToast = useGameStore((s) => s.setTonDepositToast)

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(id)
  }, [toast, setToast])

  if (!toast) return null

  return (
    <div className={styles.toast} onClick={() => setToast(null)}>
      <span style={{ fontSize: 20 }}>◈</span>
      <span style={{ fontWeight: 700, fontSize: 15, color: '#22d3ee' }}>
        +{toast.amount.toFixed(4)} TON
      </span>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
        зачислено на баланс
      </span>
    </div>
  )
}
