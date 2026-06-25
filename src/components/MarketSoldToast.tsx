import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import styles from './TonDepositToast.module.css'

export function MarketSoldToast() {
  const toast    = useGameStore((s) => s.marketSoldToast)
  const setToast = useGameStore((s) => s.setMarketSoldToast)
  const { t, i18n } = useTranslation()

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(id)
  }, [toast, setToast])

  if (!toast) return null

  const isTon    = toast.currency === 'ton'
  const payout   = toast.payout ?? toast.price
  const payoutStr = isTon
    ? `◈ ${payout.toFixed(4)} TON`
    : `⬡ ${Math.floor(payout).toLocaleString()}`

  const isEn = i18n.language === 'en'
  const unitLabel = toast.unitType === 'drone'
    ? (isEn ? '🚁 Drone' : '🚁 Дрон')
    : (isEn ? '🗼 Turret' : '🗼 Башня')

  return (
    <div
      className={styles.toast}
      style={{
        borderColor: 'rgba(34,197,94,0.5)',
        background: 'linear-gradient(135deg, rgba(34,197,94,0.18), rgba(16,185,129,0.08))',
        cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start',
      }}
      onClick={() => setToast(null)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 22 }}>🎉</span>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#4ade80' }}>
          {isEn ? 'Listing sold!' : 'Лот продан!'}
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', paddingLeft: 30, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span>{unitLabel}</span>
        <span style={{ color: '#4ade80', fontWeight: 700 }}>
          {isEn ? 'You receive: ' : 'Получено: '}{payoutStr}
        </span>
        {toast.buyerName && (
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
            {isEn ? 'Buyer: ' : 'Покупатель: '}{toast.buyerName}
          </span>
        )}
      </div>
    </div>
  )
}
