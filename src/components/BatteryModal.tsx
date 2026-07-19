import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { buyBattery, getBatteryStatus } from '../api'
import type { BatteryStatus } from '../api'
import styles from './BatteryModal.module.css'

declare global {
  interface Window {
    Telegram?: { WebApp?: { openInvoice?: (url: string, cb: (status: string) => void) => void } }
  }
}

export function BatteryModal() {
  const { t } = useTranslation()
  const open              = useGameStore((s) => s.batteryModalOpen)
  const closeBatteryModal = useGameStore((s) => s.closeBatteryModal)
  const loadGameState     = useGameStore((s) => s.loadGameState)

  const [status, setStatus] = useState<BatteryStatus | null>(null)
  const [busy, setBusy]     = useState(false)
  const [toast, setToast]   = useState<{ msg: string; ok: boolean } | null>(null)

  useEffect(() => {
    if (!open) return
    getBatteryStatus().then(setStatus).catch(() => setStatus(null))
  }, [open])

  if (!open) return null

  const canBuy = status?.available !== false

  const cooldownLabel = status?.next_available_at
    ? new Date(status.next_available_at * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : null

  const handleBuy = async () => {
    if (busy || !canBuy) return
    setBusy(true)
    try {
      const { invoice_url } = await buyBattery()
      const tg = window.Telegram?.WebApp
      if (tg?.openInvoice) {
        tg.openInvoice(invoice_url, (s) => {
          setBusy(false)
          if (s === 'paid') {
            setToast({ msg: t('battery.paid'), ok: true })
            setTimeout(() => {
              loadGameState()
              closeBatteryModal()
            }, 1200)
          } else if (s === 'cancelled') {
            setToast({ msg: t('battery.cancelled'), ok: false })
            setTimeout(() => setToast(null), 2500)
          } else {
            setToast({ msg: t('battery.failed'), ok: false })
            setTimeout(() => setToast(null), 2500)
          }
        })
      } else {
        setBusy(false)
        setToast({ msg: 'Dev: ' + invoice_url, ok: true })
        setTimeout(() => setToast(null), 3000)
      }
    } catch {
      setBusy(false)
      setToast({ msg: t('battery.failed'), ok: false })
      setTimeout(() => setToast(null), 2500)
    }
  }

  return (
    <div className={styles.overlay} onClick={closeBatteryModal}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={closeBatteryModal}>×</button>
        <div className={styles.icon}>🔋</div>
        <h2 className={styles.title}>{t('battery.title')}</h2>
        <p className={styles.desc}>{t('battery.desc', { amount: status?.energy_amount ?? 50 })}</p>

        {canBuy ? (
          <button className={styles.buyBtn} onClick={handleBuy} disabled={busy}>
            {busy ? t('battery.processing') : t('battery.buyFor', { stars: status?.stars_price ?? 30 })}
          </button>
        ) : (
          <div className={styles.cooldown}>
            {t('battery.cooldown', { time: cooldownLabel ?? '' })}
          </div>
        )}

        {toast && (
          <div className={`${styles.toast} ${toast.ok ? styles.toastOk : styles.toastErr}`}>
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  )
}
