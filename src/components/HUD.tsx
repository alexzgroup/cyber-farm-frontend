import { useGameStore } from '../store/gameStore'
import styles from './HUD.module.css'

export function HUD() {
  const balance       = useGameStore((s) => s.balance)
  const energy        = useGameStore((s) => s.energy)
  const maxEnergy     = useGameStore((s) => s.maxEnergy)
  const energyProgress = useGameStore((s) => s.energyProgress)

  const isRegening = energy < maxEnergy
  // Sub-unit fill: current integer fill + fractional progress
  const fillPct = ((energy + energyProgress) / maxEnergy) * 100

  return (
    <div className={styles.hud}>
      <div className={styles.balance}>
        <span className={styles.coinIcon}>⬡</span>
        <span className={styles.balanceValue}>{balance.toFixed(1)}</span>
      </div>
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
    </div>
  )
}
