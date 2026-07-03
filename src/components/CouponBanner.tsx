import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import styles from './CouponBanner.module.css'

// Inline "У вас действует купон -X% [Подробнее →]" action row rendered at
// the top of Shop / TopUp. Clicking it dispatches openCouponModal — the
// modal itself lives in App.tsx (see CouponDetailsModal) so it can be
// triggered from anywhere (e.g., the HUD coupon chip on the farm screen).
export function CouponBanner() {
  const { t }   = useTranslation()
  const coupon  = useGameStore((s) => s.activeCoupon)
  const openModal = useGameStore((s) => s.openCouponModal)

  if (!coupon) return null

  return (
    <button
      type="button"
      className={styles.headline}
      data-testid="coupon-headline"
      onClick={openModal}
    >
      <span className={styles.headlineText}>
        🎫 {t('coupon.headline', { pct: coupon.discountPct })}
      </span>
      <span className={styles.headlineMore}>{t('coupon.more')} →</span>
    </button>
  )
}
