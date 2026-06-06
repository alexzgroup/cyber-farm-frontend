import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import styles from './SettingsModal.module.css'

interface Props {
  onClose: () => void
}

export function SettingsModal({ onClose }: Props) {
  const soundEnabled = useGameStore((s) => s.soundEnabled)
  const toggleSound  = useGameStore((s) => s.toggleSound)

  const { t } = useTranslation()
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{t('settings.title')}</span>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <div className={styles.row}>
          <div className={styles.rowLabel}>
            <span className={styles.rowIcon}>{soundEnabled ? '🔊' : '🔇'}</span>
            <span>{t('settings.sound')}</span>
          </div>
          <button
            className={`${styles.toggle} ${soundEnabled ? styles.toggleOn : styles.toggleOff}`}
            onClick={toggleSound}
            aria-label="Toggle sound"
          >
            <span className={styles.toggleThumb} />
          </button>
        </div>
      </div>
    </div>
  )
}
