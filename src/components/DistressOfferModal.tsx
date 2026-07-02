import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import * as api from '../api'
import { webApp } from '../telegram/webApp'
import styles from './DistressOfferModal.module.css'

// Triggered -50% Starter offer. Shown once per active trigger cycle when
// the backend flags `distress_offer.active` in /me. "Позже" snoozes it
// server-side for 24h; buying flips it off permanently.
export function DistressOfferModal() {
  const { t } = useTranslation()
  const isLoaded    = useGameStore((s) => s.isLoaded)
  const activeScreen = useGameStore((s) => s.activeScreen)
  const offer       = useGameStore((s) => s.distressOffer)

  const [visible, setVisible] = useState(false)
  const [busy, setBusy]       = useState(false)

  useEffect(() => {
    if (!isLoaded || !offer?.active) return
    if (activeScreen !== 'farm') return
    // Delay so DailyBonusModal / other higher-priority modals show first.
    const id = setTimeout(() => setVisible(true), 1200)
    return () => clearTimeout(id)
  }, [isLoaded, offer?.active, activeScreen])

  if (!visible || !offer) return null

  const close = () => setVisible(false)

  const handleBuy = async () => {
    if (busy) return
    setBusy(true)
    // Clear local state and snooze the offer server-side BEFORE opening the
    // invoice. If the user closes the Telegram invoice sheet without paying
    // and re-opens the Mini App, /me must not return distress_offer=active
    // again — otherwise a second invoice could be generated and the user
    // could double-charge themselves (bot back-ends the actual flag flip
    // only on successful_payment).
    useGameStore.setState({ distressOffer: null })
    try { await api.dismissDistressOffer() } catch { /* non-fatal */ }
    try {
      const { invoice_url } = await api.buyDistressPack()
      webApp.openInvoice?.(invoice_url, (status) => {
        if (status === 'paid') {
          // Full refresh — /me will now report distress_offer=null and grant gold.
          useGameStore.getState().loadGameState()
        }
      })
      close()
    } catch (err) {
      console.warn('[CyberFarm] distress buy failed', err)
    } finally {
      setBusy(false)
    }
  }

  const handleLater = async () => {
    if (busy) return
    setBusy(true)
    close()
    try {
      await api.dismissDistressOffer()
      useGameStore.setState({ distressOffer: null })
    } catch (err) {
      console.warn('[CyberFarm] distress dismiss failed', err)
    } finally {
      setBusy(false)
    }
  }

  const subtitleKey = offer.reason === 'raids' ? 'distress.subtitleRaids' : 'distress.subtitleLowBalance'

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.card}>
        <div className={styles.badge}>-50%</div>
        <div className={styles.icon} aria-hidden="true">🎁</div>
        <h2 className={styles.title}>{t('distress.title')}</h2>
        <p className={styles.subtitle}>{t(subtitleKey)}</p>

        <div className={styles.reward}>
          <span className={styles.gold}>+{offer.goldAmount}</span>
          <span className={styles.goldLabel}>🪙 gold</span>
        </div>

        <div className={styles.priceRow}>
          <span className={styles.oldPrice}>{offer.starsPrice * 2}⭐</span>
          <span className={styles.newPrice}>{offer.starsPrice}⭐</span>
        </div>

        <button className={styles.buyBtn} onClick={handleBuy} disabled={busy}>
          {busy ? '…' : t('distress.buyBtn', { stars: offer.starsPrice })}
        </button>
        <button className={styles.laterBtn} onClick={handleLater} disabled={busy}>
          {t('distress.laterBtn')}
        </button>
      </div>
    </div>
  )
}
