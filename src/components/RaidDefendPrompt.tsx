import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import styles from './RaidDefendPrompt.module.css'

export function RaidDefendPrompt() {
  const { t } = useTranslation()
  const visible         = useGameStore((s) => s.defendPromptVisible)
  const hide            = useGameStore((s) => s.hideDefendPrompt)
  const openShieldModal = useGameStore((s) => s.openShieldModal)

  if (!visible) return null

  return (
    <div className={styles.prompt} role="dialog" aria-label={t('raids.defendPromptTitle')}>
      <div className={styles.icon} aria-hidden>
        <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 4 5v6c0 5 3.4 9.5 8 11 4.6-1.5 8-6 8-11V5l-8-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      </div>
      <div className={styles.body}>
        <div className={styles.title}>{t('raids.defendPromptTitle')}</div>
        <div className={styles.text}>{t('raids.defendPromptText')}</div>
      </div>
      <button className={styles.buyBtn} onClick={openShieldModal} data-testid="defend-prompt-buy">
        {t('raids.defendPromptBuy')}
      </button>
      <button className={styles.close} onClick={hide} aria-label="close">×</button>
    </div>
  )
}
