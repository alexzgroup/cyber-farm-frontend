import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import styles from './FAQScreen.module.css'

// Identifiers correspond to keys under `faq.items` in the i18n files. Order
// here drives display order in the list.
const ITEMS = [
  { id: 'airdrop',   icon: '🪂' },
  { id: 'essence',   icon: '🎯' },
  { id: 'earning',   icon: '💰' },
  { id: 'raids',     icon: '⚔️' },
  { id: 'p2p',       icon: '🛒' },
  { id: 'referrals', icon: '🤝' },
  { id: 'staking',   icon: '🔒' },
  { id: 'battlepass', icon: '🎟' },
  { id: 'vip',       icon: '💎' },
  { id: 'rules',     icon: '🛡️' },
] as const

export function FAQScreen() {
  const { t } = useTranslation()
  const setScreen = useGameStore((s) => s.setScreen)
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <button className={styles.back} onClick={() => setScreen('farm')} aria-label="Back">←</button>
        <h1 className={styles.title}>{t('faq.title')}</h1>
      </div>
      <p className={styles.subtitle}>{t('faq.subtitle')}</p>

      <div className={styles.list}>
        {ITEMS.map((it) => {
          const open = openId === it.id
          return (
            <div key={it.id} className={`${styles.item} ${open ? styles.itemOpen : ''}`}>
              <button
                className={styles.btn}
                onClick={() => setOpenId(open ? null : it.id)}
                aria-expanded={open}
              >
                <span className={styles.icon} aria-hidden="true">{it.icon}</span>
                <span className={styles.btnText}>{t(`faq.items.${it.id}.title`)}</span>
                <span className={`${styles.chev} ${open ? styles.chevOpen : ''}`}>▾</span>
              </button>
              <div className={`${styles.body} ${open ? styles.bodyOpen : ''}`}>
                <div className={styles.bodyInner}>
                  <p>{t(`faq.items.${it.id}.body`)}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
