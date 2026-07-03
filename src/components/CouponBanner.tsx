import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { formatCountdown, useNowSecond } from '../utils/countdown'
import styles from './CouponBanner.module.css'

// Compact "У вас действует купон -X%" headline shown at the top of the
// Shop / TopUp screens when the user has an active coupon. Clicking the
// headline opens a bottom-sheet modal with the full banner (source,
// timer, "auto-applies to any Stars pack" explainer).
//
// The server applies the discount silently on every Stars invoice — this
// component is purely a UX confirmation so the user understands why the
// price in stars is lower than the sticker.
export function CouponBanner() {
  const { t }   = useTranslation()
  const coupon  = useGameStore((s) => s.activeCoupon)
  const now     = useNowSecond()
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!coupon) return null
  const remaining = formatCountdown(coupon.validUntil, now)
  if (!remaining) return null

  const sourceKey =
    coupon.source === 'ad_stack'      ? 'coupon.sourceAdStack'
    : coupon.source === 'welcome_back' ? 'coupon.sourceWelcomeBack'
    :                                   'coupon.sourceAdmin'

  const close = () => {
    setClosing(true)
    setTimeout(() => { setOpen(false); setClosing(false) }, 250)
  }

  return (
    <>
      <button
        type="button"
        className={styles.headline}
        data-testid="coupon-headline"
        onClick={() => setOpen(true)}
      >
        <span className={styles.headlineText}>
          🎫 {t('coupon.headline', { pct: coupon.discountPct })}
        </span>
        <span className={styles.headlineMore}>{t('coupon.more')} →</span>
      </button>

      {open && (
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
            <button
              type="button"
              className={styles.sheetClose}
              onClick={close}
              aria-label="close"
            >×</button>
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
      )}
    </>
  )
}
