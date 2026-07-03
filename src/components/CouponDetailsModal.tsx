import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { formatCountdown, useNowSecond } from '../utils/countdown'
import styles from './CouponBanner.module.css'

// Global coupon details modal — slides up from the bottom onto center.
// Mounted once in App.tsx; anyone can open it via useGameStore.openCouponModal
// (HUD coupon chip, Shop / TopUp headline, etc.).
export function CouponDetailsModal() {
  const { t }         = useTranslation()
  const coupon        = useGameStore((s) => s.activeCoupon)
  const open          = useGameStore((s) => s.couponModalOpen)
  const closeStore    = useGameStore((s) => s.closeCouponModal)
  const now           = useNowSecond()
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!open || !coupon) return null
  const remaining = formatCountdown(coupon.validUntil, now)
  if (!remaining) return null

  const sourceKey =
    coupon.source === 'ad_stack'      ? 'coupon.sourceAdStack'
    : coupon.source === 'welcome_back' ? 'coupon.sourceWelcomeBack'
    :                                   'coupon.sourceAdmin'

  const close = () => {
    setClosing(true)
    setTimeout(() => { closeStore(); setClosing(false) }, 250)
  }

  return (
    <div
      className={`${styles.backdrop} ${closing ? styles.leaving : ''}`}
      onClick={close}
      data-testid="coupon-modal-backdrop"
    >
      <div
        className={`${styles.sheet} ${closing ? styles.sheetLeaving : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button type="button" className={styles.sheetClose} onClick={close} aria-label="close">×</button>
        <div className={styles.banner} data-testid="coupon-banner">
          <div className={styles.left}>
            <div className={styles.pct}>−{coupon.discountPct}%</div>
            <div className={styles.timer}>⏱ {remaining}</div>
          </div>
          <div className={styles.text}>
            <div className={styles.title}>{t(sourceKey)}</div>
            <div className={styles.body}>
              <Trans i18nKey="coupon.bannerBody" values={{ pct: coupon.discountPct }} components={{ b: <b /> }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
