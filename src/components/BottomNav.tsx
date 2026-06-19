import { useTranslation } from 'react-i18next'
import { useGameStore, Screen } from '../store/gameStore'
import styles from './BottomNav.module.css'

const TABS: { id: Screen; icon: string; key: string }[] = [
  { id: 'farm',    icon: '⚡', key: 'nav.farm'    },
  { id: 'shop',    icon: '🛒', key: 'nav.shop'    },
  { id: 'duel',   icon: '⚔️',  key: 'nav.duel'    },
  { id: 'market',  icon: '💱', key: 'nav.market'  },
  { id: 'profile', icon: '👤', key: 'nav.profile' },
]

const SCREEN_PARENT: Partial<Record<string, string>> = {
  equipment:     'farm',
  'unit-detail': 'farm',
  purchases:     'farm',
  topup:         'profile',
  market:        'market',
  raids:          'duel',
  'duel-battle':  'duel',
  'duel-history': 'duel',
}

export function BottomNav() {
  const { t } = useTranslation()
  const activeScreen = useGameStore((s) => s.activeScreen)
  const setScreen    = useGameStore((s) => s.setScreen)
  const activeTab    = SCREEN_PARENT[activeScreen] ?? activeScreen

  return (
    <nav className={styles.nav}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={styles.tab + (activeTab === tab.id ? ' ' + styles.active : '')}
          onClick={() => setScreen(tab.id)}
        >
          <span className={styles.icon}>{tab.icon}</span>
          <span className={styles.label}>{t(tab.key)}</span>
        </button>
      ))}
    </nav>
  )
}
