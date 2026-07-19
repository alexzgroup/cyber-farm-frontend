import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { fmtGold } from '../utils/format'
import { SettingsModal } from './SettingsModal'
import { CouponChip } from './CouponChip'
import { formatCountdown, useNowSecond } from '../utils/countdown'
import styles from './HUD.module.css'

export function HUD() {
  const { t }          = useTranslation()
  const balance        = useGameStore((s) => s.balance)
  const energy         = useGameStore((s) => s.energy)
  const maxEnergy      = useGameStore((s) => s.maxEnergy)
  const regenPerMin    = useGameStore((s) => s.energyRegenPerMin)
  const energyProgress = useGameStore((s) => s.energyProgress)
  const soundEnabled   = useGameStore((s) => s.soundEnabled)
  const isLoaded          = useGameStore((s) => s.isLoaded)
  const hasStarsPurchase  = useGameStore((s) => s.hasStarsPurchase)
  const starterExpiresAt  = useGameStore((s) => s.starterExpiresAt)
  const setScreen         = useGameStore((s) => s.setScreen)
  const batteryAvailable  = useGameStore((s) => s.batteryAvailable)
  const openBatteryModal  = useGameStore((s) => s.openBatteryModal)
  const bannedUntil       = useGameStore((s) => s.bannedUntil)
  const openBanOverlay    = useGameStore((s) => s.openBanOverlay)

  const [showSettings, setShowSettings] = useState(false)
  const nowMs = useNowSecond()
  const isBanned = bannedUntil != null && bannedUntil > nowMs
  // Star icon is a permanent shop-shortcut while the user hasn't bought a
  // Stars pack — visibility no longer depends on the FOMO timer. The timer
  // just decorates the chip when it's still ticking; once it expires the
  // chip degrades to a compact icon-only button.
  const showStarterOffer = isLoaded && !hasStarsPurchase
  const timerActive      = !!starterExpiresAt && starterExpiresAt > nowMs
  const starterCountdown = timerActive ? formatCountdown(starterExpiresAt!, nowMs) : ''

  const isRegening = energy < maxEnergy
  const fillPct    = ((energy + energyProgress) / maxEnergy) * 100
  const rateNumber = regenPerMin > 0
    ? (Number.isInteger(regenPerMin) ? regenPerMin : regenPerMin.toFixed(1))
    : ''

  // Starter chip — moves between LEFT column (under coupon) and RIGHT column
  // (under sound) depending on whether the timer is showing. With the timer
  // the chip is wide and would clash with sound; without it, it's a compact
  // star icon that balances nicely on the right.
  const renderStarterChip = () => (
    <button
      className={`${styles.starterBtn} ${starterCountdown ? styles.starterBtnWithTimer : styles.starterBtnCompact}`}
      onClick={() => setScreen('topup')}
      aria-label={t('starter.hudLabel')}
      data-testid="hud-starter-icon"
      type="button"
    >
      <span className={styles.starterBtnIcon}>
        ⭐
        <span className={styles.starterBtnDot} />
      </span>
      {starterCountdown && (
        <span className={styles.starterBtnTimer}>{starterCountdown}</span>
      )}
    </button>
  )
  // Star chip always lives in the right column (under sound). The pill
  // variant is absolute-positioned in CSS so it doesn't stretch the column
  // and compress the energy panel.
  const starterOnLeft  = false
  const starterOnRight = showStarterOffer

  return (
    <>
      <div className={styles.topbar}>
        {/* ── Left: hex + amount on row 1, coupon chip drops to row 2 so
             it can't collide with the energy panel when it appears ── */}
        <div className={styles.coin}>
          <div className={styles.coinRow}>
            <span className={styles.hexwrap} aria-hidden="true">
              <svg width="26" height="28" viewBox="0 0 26 28" fill="none">
                <path d="M13 1.5 24 8v12L13 26.5 2 20V8L13 1.5Z" fill="#0c1424" stroke="#f6c544" strokeWidth="1.6"/>
                <path d="M13 6 19.5 9.8v8L13 21.5 6.5 17.8v-8L13 6Z" fill="none" stroke="#f6c544" strokeWidth="1.3" opacity=".55"/>
              </svg>
            </span>
            <span className={styles.amt}>{fmtGold(balance)}</span>
          </div>
          <CouponChip />
          {starterOnLeft && renderStarterChip()}
        </div>

        {/* ── Center: energy panel — 3 rows ── */}
        <div className={styles.energy}>
          <div className={styles.energyTop}>
            <span className={styles.cap}>{energy}/{maxEnergy}</span>
            <svg width="12" height="14" viewBox="0 0 12 14" fill="#f6c544" aria-hidden="true">
              <path d="M7 0 0 8h4l-1 6 8-9H6l1-5Z"/>
            </svg>
            <button
              className={styles.plus}
              onClick={() => setScreen('topup')}
              aria-label="Top up energy"
              type="button"
            >+</button>
            {batteryAvailable && (
              <button
                className={styles.battery}
                onClick={() => {
                  useGameStore.setState({ batteryModalDismissed: false })
                  openBatteryModal()
                }}
                aria-label={t('battery.title')}
                title={t('battery.title')}
                type="button"
              >
                🔋
              </button>
            )}
          </div>
          <div className={styles.bar}>
            <i
              className={`${styles.barFill} ${isRegening ? styles.regening : ''}`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
          {rateNumber !== '' && (
            <div className={styles.rate}>
              <span>+{rateNumber}</span>
              <svg width="9" height="11" viewBox="0 0 12 14" fill="#f6c544" aria-hidden="true">
                <path d="M7 0 0 8h4l-1 6 8-9H6l1-5Z"/>
              </svg>
              <span>/{t('hud.perMin')}</span>
            </div>
          )}
        </div>

        {/* ── Right: sound + optional starter promo star ── */}
        <div className={styles.controls}>
          <button
            className={styles.sound}
            onClick={() => setShowSettings(true)}
            aria-label={t('hud.settings')}
            type="button"
          >
            {soundEnabled ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" stroke="none"/>
                <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" stroke="none"/>
                <path d="M16 9l6 6M22 9l-6 6"/>
              </svg>
            )}
          </button>

          {starterOnRight && renderStarterChip()}
          {isBanned && (
            <button
              type="button"
              className={styles.banWarning}
              onClick={openBanOverlay}
              aria-label={t('ban.title')}
              title={t('ban.title')}
            >
              ⚠
            </button>
          )}
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  )
}
