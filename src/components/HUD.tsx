import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { fmtGold } from '../utils/format'
import { SettingsModal } from './SettingsModal'
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
  const setScreen         = useGameStore((s) => s.setScreen)

  const [showSettings, setShowSettings] = useState(false)
  const showStarterOffer = isLoaded && !hasStarsPurchase

  const isRegening = energy < maxEnergy
  const fillPct    = ((energy + energyProgress) / maxEnergy) * 100
  // Hint shown under the energy bar. Round to 1 decimal, drop the .0 for whole numbers.
  const regenText = regenPerMin > 0
    ? t('hud.energyRegen', { rate: Number.isInteger(regenPerMin) ? regenPerMin : regenPerMin.toFixed(1) })
    : ''

  return (
    <>
      <div className={styles.hud}>
        <div className={styles.balance}>
          <span className={styles.coinIcon}>⬡</span>
          <span className={styles.balanceValue}>{fmtGold(balance)}</span>
        </div>

        <div className={styles.right}>
          <div className={styles.energyWrap}>
            <div className={styles.energy}>
              <div className={styles.energyBar}>
                <div
                  className={`${styles.energyFill} ${isRegening ? styles.regening : ''}`}
                  style={{ width: `${fillPct}%` }}
                />
              </div>
              <span className={styles.energyLabel}>
                {energy}/{maxEnergy} ⚡{isRegening ? ' +' : ''}
              </span>
            </div>
            {regenText && <span className={styles.energyHint}>{regenText}</span>}
          </div>

          {showStarterOffer && (
            <button
              className={styles.starterBtn}
              onClick={() => setScreen('topup')}
              aria-label={t('starter.hudLabel')}
              data-testid="hud-starter-icon"
            >
              <span className={styles.starterBtnIcon}>⭐</span>
              <span className={styles.starterBtnDot} />
            </button>
          )}

          <button
            className={styles.settingsBtn}
            onClick={() => setShowSettings(true)}
            aria-label="Настройки"
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  )
}
