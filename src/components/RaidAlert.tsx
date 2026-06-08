import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { useTranslation } from 'react-i18next'
import styles from './RaidAlert.module.css'

export function RaidAlert() {
  const { t } = useTranslation()
  const notification      = useGameStore((s) => s.incomingRaidNotification)
  const clearNotification = useGameStore((s) => s.clearIncomingNotification)

  useEffect(() => {
    if (!notification) return
    const id = setTimeout(clearNotification, 5000)
    return () => clearTimeout(id)
  }, [notification, clearNotification])

  if (!notification) return null

  const defended = notification.won
  const icon     = defended ? '🛡' : '💥'
  const amountStr = parseFloat(notification.amount.toFixed(3)).toString()
  const label    = defended
    ? t('raids.alertDefended', { name: notification.attackerName, amount: amountStr })
    : t('raids.alertLost',     { name: notification.attackerName, amount: amountStr })

  return (
    <div className={`${styles.alert} ${defended ? styles.defended : styles.lost}`} onClick={clearNotification}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.text}>{label}</span>
      <span className={styles.close}>×</span>
    </div>
  )
}
