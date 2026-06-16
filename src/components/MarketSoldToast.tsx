import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import styles from './TonDepositToast.module.css'

export function MarketSoldToast() {
  const toast    = useGameStore((s) => s.marketSoldToast)
  const setToast = useGameStore((s) => s.setMarketSoldToast)
  const { i18n } = useTranslation()

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(id)
  }, [toast, setToast])

  if (!toast) return null

  const isTon = toast.currency === 'ton'
  const priceStr = isTon
    ? `◈ ${toast.price.toFixed(4)} TON`
    : `⬡ ${toast.price.toLocaleString('ru')}`

  const label = i18n.language === 'en' ? 'listing sold!' : 'лот продан!'

  return (
    <div
      className={styles.toast}
      style={{ borderColor: 'rgba(34,197,94,0.5)', background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.08))' }}
      onClick={() => setToast(null)}
    >
      <span style={{ fontSize: 20 }}>🎉</span>
      <span style={{ fontWeight: 700, fontSize: 15, color: '#4ade80' }}>{priceStr}</span>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{label}</span>
    </div>
  )
}
