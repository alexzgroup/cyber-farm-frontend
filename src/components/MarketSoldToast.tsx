import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import styles from './TonDepositToast.module.css'

export function MarketSoldToast() {
  const toast    = useGameStore((s) => s.marketSoldToast)
  const setToast = useGameStore((s) => s.setMarketSoldToast)
  const { t } = useTranslation()

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(id)
  }, [toast, setToast])

  if (!toast) return null

  const isTon     = toast.currency === 'ton'
  const payout    = toast.payout ?? toast.price
  const payoutStr = isTon
    ? `◈ ${payout.toFixed(4)} TON`
    : `⬡ ${Math.floor(payout).toLocaleString()}`

  const unitLabel = toast.unitType === 'drone'
    ? t('market.soldUnitDrone')
    : t('market.soldUnitTurret')

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
          {t('market.soldTitle')}
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', paddingLeft: 30, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span>{t('market.soldUnit')}: {unitLabel}</span>
        <span style={{ color: '#4ade80', fontWeight: 700 }}>
          {t('market.soldReceived')}: {payoutStr}
        </span>
        {toast.buyerName && (
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
            {t('market.soldBuyer')}: {toast.buyerName}
          </span>
        )}
      </div>
    </div>
  )
}
