import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import styles from './WelcomeBackModal.module.css'

const SEEN_KEY_PREFIX = 'cf:welcome-back-seen:'

// Auto-modal that greets users who came back after 72h+ away — the server
// mints a -30% coupon at /auth/telegram and we surface it here once per
// coupon (keyed by valid_until so a NEW welcome_back coupon shows again).
export function WelcomeBackModal() {
  const { t } = useTranslation()
  const isLoaded    = useGameStore((s) => s.isLoaded)
  const activeScreen = useGameStore((s) => s.activeScreen)
  const setScreen    = useGameStore((s) => s.setScreen)
  const coupon      = useGameStore((s) => s.activeCoupon)

  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isLoaded || activeScreen !== 'farm') return
    if (!coupon || coupon.source !== 'welcome_back') return
    const key = SEEN_KEY_PREFIX + coupon.validUntil
    if (localStorage.getItem(key) === '1') return
    const id = setTimeout(() => {
      setVisible(true)
      localStorage.setItem(key, '1')
    }, 1500)
    return () => clearTimeout(id)
  }, [isLoaded, activeScreen, coupon?.validUntil, coupon?.source])

  if (!visible || !coupon) return null

  const close = () => setVisible(false)
  const goShop = () => { close(); setScreen('shop') }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" data-testid="welcome-back-modal">
      <div className={styles.card}>
        <div className={styles.icon} aria-hidden="true">🎁</div>
        <h2 className={styles.title}>{t('welcomeBack.title')}</h2>
        <p className={styles.body}><Trans i18nKey="welcomeBack.body" components={{ b: <b /> }} /></p>
        <div className={styles.badge}>−{coupon.discountPct}%</div>
        <button className={styles.cta} onClick={goShop}>{t('welcomeBack.cta')}</button>
        <button className={styles.later} onClick={close}>{t('welcomeBack.later')}</button>
      </div>
    </div>
  )
}
