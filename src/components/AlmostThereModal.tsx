import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { STARTER_PACK } from '../constants/starter'
import { buyProduct, getShopProducts } from '../api'
import { webApp } from '../telegram/webApp'
import styles from './AlmostThereModal.module.css'

// Micro-upsell fired when a drone/turret buy fails with insufficient gold.
// Suggests the cheapest Stars pack (Starter) so the user can immediately
// complete their intended purchase. Called imperatively by whoever caught
// the "insufficient balance" error (see gameStore.buyDrone/upgradeDrone).
export function AlmostThereModal({ need, onClose }: { need: number; onClose: () => void }) {
  const { t } = useTranslation()
  const hasStarsPurchase = useGameStore((s) => s.hasStarsPurchase)
  const loadGameState    = useGameStore((s) => s.loadGameState)
  const [busy, setBusy]  = useState(false)

  const stars = STARTER_PACK.stars
  const gold  = STARTER_PACK.goldAmount

  const handleBuy = async () => {
    if (busy) return
    setBusy(true)
    try {
      // If the user already claimed Starter — grab whatever's cheapest available.
      const products = await getShopProducts()
      const pick = hasStarsPurchase
        ? products.sort((a, b) => a.stars_price - b.stars_price)[0]
        : products.find(p => p.stars_price === stars) ?? products[0]
      if (!pick) { onClose(); return }
      const { invoice_url } = await buyProduct(pick.id)
      webApp.openInvoice?.(invoice_url, (status) => {
        if (status === 'paid') loadGameState()
      })
      onClose()
    } catch {
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" data-testid="almost-there-modal">
      <div className={styles.card}>
        <div className={styles.icon} aria-hidden="true">💰</div>
        <h3 className={styles.title}>{t('almostThere.title')}</h3>
        <p className={styles.body}>
          <Trans i18nKey="almostThere.body" values={{ need, stars, gold }} components={{ b: <b /> }} />
        </p>
        <button className={styles.cta} disabled={busy} onClick={handleBuy}>
          {t('almostThere.cta', { stars })}
        </button>
        <button className={styles.cancel} onClick={onClose}>{t('almostThere.cancel')}</button>
      </div>
    </div>
  )
}
