import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { buyRescuePack } from '../api'
import { webApp } from '../telegram/webApp'
import styles from './RescueBundleCard.module.css'

// Post-Starter upsell card: only shown to users who already made at least
// one Stars purchase. Server enforces both conditions (has_starter, no
// prior rescue). Frontend just short-circuits when we can locally tell
// the user isn't eligible yet.
const GOLD = 800
const SHIELD_DAYS = 3
const STARS_BASE = 30

export function RescueBundleCard() {
  const { t } = useTranslation()
  const hasStarsPurchase = useGameStore((s) => s.hasStarsPurchase)
  const hasRescuePack    = useGameStore((s) => s.hasRescuePack)
  const activeCoupon     = useGameStore((s) => s.activeCoupon)
  const loadGameState    = useGameStore((s) => s.loadGameState)
  const [dismissed, setDismissed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => { setDismissed(false) }, [hasStarsPurchase])

  // Hidden until the user has any prior Stars purchase, or once the Rescue
  // Bundle has been purchased (server-authoritative one-shot flag).
  if (!hasStarsPurchase || hasRescuePack || dismissed) return null

  const stars = activeCoupon
    ? Math.max(1, Math.ceil(STARS_BASE * (100 - activeCoupon.discountPct) / 100))
    : STARS_BASE

  const handleBuy = async () => {
    if (busy) return
    setBusy(true)
    try {
      const { invoice_url } = await buyRescuePack()
      webApp.openInvoice?.(invoice_url, (status) => {
        if (status === 'paid') { setDismissed(true); loadGameState() }
      })
    } catch (err) {
      const msg = (err as Error).message ?? ''
      if (msg.includes('already used')) setDismissed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={styles.card}
      onClick={handleBuy}
      disabled={busy}
      data-testid="rescue-bundle-card"
    >
      <span className={styles.badge}>{t('rescue.cardBadge')}</span>
      <span className={styles.icon}>🚀</span>
      <span className={styles.body}>
        <span className={styles.title}>{t('rescue.cardTitle')}</span>
        <span className={styles.desc}>{t('rescue.cardDesc', { gold: GOLD, days: SHIELD_DAYS })}</span>
      </span>
      <span className={styles.cta}>{t('rescue.cardCta', { stars })}</span>
    </button>
  )
}
