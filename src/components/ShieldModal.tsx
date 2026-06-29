import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { buyShield, getShieldPrice } from '../api'
import styles from './ShieldModal.module.css'

declare global {
  interface Window {
    Telegram?: { WebApp?: { openInvoice?: (url: string, cb: (status: string) => void) => void } }
  }
}

interface Props {
  open: boolean
  onClose: () => void
}

export function ShieldModal({ open, onClose }: Props) {
  const loadGameState = useGameStore((s) => s.loadGameState)
  const [days, setDays] = useState(1)
  const [pricePerDay, setPricePerDay] = useState(15)
  const [shieldedUntil, setShieldedUntil] = useState<number | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  useEffect(() => {
    if (!open) return
    getShieldPrice()
      .then((r) => {
        setPricePerDay(r.stars_per_day)
        setShieldedUntil(r.shielded_until)
      })
      .catch(() => {})
  }, [open])

  if (!open) return null

  const total = pricePerDay * days

  const handleBuy = async () => {
    if (busy) return
    setBusy(true)
    try {
      const { invoice_url } = await buyShield(days)
      const tg = window.Telegram?.WebApp
      if (tg?.openInvoice) {
        tg.openInvoice(invoice_url, (status) => {
          setBusy(false)
          if (status === 'paid') {
            setToast({ msg: `🛡 Щит активен на ${days} дн.`, ok: true })
            setTimeout(() => {
              loadGameState()
              onClose()
            }, 1200)
          } else if (status === 'cancelled') {
            setToast({ msg: 'Оплата отменена', ok: false })
            setTimeout(() => setToast(null), 2500)
          } else {
            setToast({ msg: 'Не удалось оплатить', ok: false })
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
      setToast({ msg: 'Ошибка запроса', ok: false })
      setTimeout(() => setToast(null), 2500)
    }
  }

  const shieldedLabel = shieldedUntil
    ? `Активен до ${new Date(shieldedUntil * 1000).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
    : null

  return (
    <>
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <button className={styles.close} onClick={onClose} aria-label="close">×</button>
          <h3 className={styles.title}>🛡 Щит от рейдов</h3>
          <p className={styles.subtitle}>Никто не сможет атаковать твою ферму, пока щит активен.</p>
          {shieldedLabel && <div className={styles.status}>{shieldedLabel}</div>}

          <div className={styles.row}>
            <span className={styles.label}>Количество дней</span>
            <div className={styles.stepper}>
              <button className={styles.stepBtn} onClick={() => setDays((d) => Math.max(1, d - 1))} disabled={days <= 1}>−</button>
              <span className={styles.days}>{days}</span>
              <button className={styles.stepBtn} onClick={() => setDays((d) => Math.min(30, d + 1))} disabled={days >= 30}>+</button>
            </div>
          </div>

          <div className={styles.price}>
            <div className={styles.priceAmt}>⭐ {total}</div>
            <div className={styles.priceLabel}>{pricePerDay} ⭐ × {days} дн.</div>
          </div>

          <button className={styles.buyBtn} onClick={handleBuy} disabled={busy}>
            {busy ? '…' : `Купить за ${total} ⭐`}
          </button>
        </div>
      </div>
      {toast && (
        <div className={`${styles.toast} ${toast.ok ? '' : styles.toastErr}`}>
          {toast.msg}
        </div>
      )}
    </>
  )
}
