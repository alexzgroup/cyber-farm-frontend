import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import styles from './NotificationPermissionToast.module.css'

// Sliding bottom prompt asking the user to enable bot notifications via the
// Telegram-native write-access dialog. Shows only when:
//   - state is loaded
//   - allowNotification is false (server-side opt-out)
//   - this session hasn't been dismissed yet (sessionStorage flag)
//   - the user is currently on the farm screen (other screens have their own focus)
const DISMISS_KEY = 'cf:notif-prompt-dismissed'

export function NotificationPermissionToast() {
  const { t } = useTranslation()
  const isLoaded          = useGameStore((s) => s.isLoaded)
  const activeScreen      = useGameStore((s) => s.activeScreen)
  const allowNotification = useGameStore((s) => s.allowNotification)
  const requestNotifs     = useGameStore((s) => s.requestNotifications)

  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [busy,    setBusy]    = useState(false)

  // Decide visibility every time the relevant state changes.
  useEffect(() => {
    if (!isLoaded) return
    if (allowNotification) return
    if (activeScreen !== 'farm') return
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return
    // Small delay so the daily-bonus modal can claim focus first.
    const id = setTimeout(() => setVisible(true), 900)
    return () => clearTimeout(id)
  }, [isLoaded, allowNotification, activeScreen])

  if (!visible) return null

  const hide = (remember: boolean) => {
    if (remember) sessionStorage.setItem(DISMISS_KEY, '1')
    setLeaving(true)
    setTimeout(() => { setVisible(false); setLeaving(false) }, 260)
  }

  const handleEnable = async () => {
    if (busy) return
    setBusy(true)
    const ok = await requestNotifs()
    setBusy(false)
    // Whether granted or rejected, we close. If rejected the toast will re-evaluate
    // on next session but stay quiet this one.
    hide(true)
    void ok
  }

  return (
    <div className={`${styles.wrap} ${leaving ? styles.leaving : ''}`} role="dialog" aria-live="polite">
      <button className={styles.close} onClick={() => hide(true)} aria-label="close">×</button>
      <div className={styles.card}>
        <div className={styles.bell} aria-hidden="true">🔔</div>
        <div className={styles.text}>
          <p className={styles.title}>{t('notif.promptTitle')}</p>
          <p className={styles.subtitle}>{t('notif.promptSubtitle')}</p>
        </div>
        <button className={styles.enable} onClick={handleEnable} disabled={busy}>
          {busy ? '…' : t('notif.enableBtn')}
        </button>
      </div>
    </div>
  )
}
