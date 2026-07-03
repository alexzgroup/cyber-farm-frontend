import { Trans, useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { formatCountdown, useNowSecond } from '../utils/countdown'
import styles from './CouponBanner.module.css'

// Full-width banner shown at the top of ShopScreen when the user has an
// active coupon. Explains the discount, the source ("watched 5 ads" /
// "welcome back") and the time remaining. Server applies the discount
// silently on every Stars invoice — the banner is pure UX confirmation
// so the user understands why prices differ from the sticker.
export function CouponBanner() {
  const { t }   = useTranslation()
  const coupon  = useGameStore((s) => s.activeCoupon)
  const now     = useNowSecond()

  if (!coupon) return null
  const remaining = formatCountdown(coupon.validUntil, now)
  if (!remaining) return null

  const sourceKey =
    coupon.source === 'ad_stack'      ? 'coupon.sourceAdStack'
    : coupon.source === 'welcome_back' ? 'coupon.sourceWelcomeBack'
    :                                   'coupon.sourceAdmin'

  return (
    <>
      <div className={styles.headline} data-testid="coupon-headline">
        🎫 {t('coupon.headline', { pct: coupon.discountPct })}
      </div>
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
    </>
  )
}
