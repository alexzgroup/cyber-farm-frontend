import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { formatCountdown, useNowSecond } from '../utils/countdown'
import styles from './CouponChip.module.css'

// Small HUD pill showing the active coupon and its countdown. Renders only
// when the user has a non-expired unused coupon. Server applies the actual
// discount at invoice creation — clicking the chip takes the user straight
// to the shop so they can spend the discount before it expires.
//
// Hidden when the Starter Pack FOMO chip is active — one promo at a time
// keeps the HUD readable. The coupon still applies to every purchase; it
// gets a dedicated banner on the Shop screen instead.
export function CouponChip() {
  const { t } = useTranslation()
  const coupon    = useGameStore((s) => s.activeCoupon)
  const setScreen = useGameStore((s) => s.setScreen)
  const hasStarsPurchase = useGameStore((s) => s.hasStarsPurchase)
  const starterExpiresAt = useGameStore((s) => s.starterExpiresAt)
  const now       = useNowSecond()

  if (!coupon) return null
  const remaining = formatCountdown(coupon.validUntil, now)
  if (!remaining) return null

  // Hide only when the starter TIMER chip (pill on the left) is showing —
  // that lives in the same column as the coupon chip. When the timer is
  // expired the star degrades to a compact icon on the right, and both
  // promos can coexist without collision.
  const starterTimerActive = !hasStarsPurchase && !!starterExpiresAt && starterExpiresAt > now
  if (starterTimerActive) return null

  const sourceKey =
    coupon.source === 'ad_stack'      ? 'coupon.sourceAdStack'
    : coupon.source === 'welcome_back' ? 'coupon.sourceWelcomeBack'
    :                                   'coupon.sourceAdmin'

  return (
    <button
      type="button"
      className={styles.chip}
      data-testid="coupon-chip"
      title={t(sourceKey)}
      onClick={() => setScreen('shop')}
    >
      <span className={styles.pct}>−{coupon.discountPct}%</span>
      <span className={styles.time}>⏱ {remaining}</span>
    </button>
  )
}
