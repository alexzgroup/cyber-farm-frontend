import { useGameStore, Screen } from '../store/gameStore'
import styles from './BottomNav.module.css'

const TABS: { id: Screen; icon: string; label: string }[] = [
  { id: 'farm',    icon: '⚡', label: 'Ферма'   },
  { id: 'shop',    icon: '🛒', label: 'Магазин' },
  { id: 'raids',   icon: '⚔️',  label: 'Рейды'   },
  { id: 'market',  icon: '💱', label: 'Рынок'   },
  { id: 'profile', icon: '👤', label: 'Профиль' },
]

// sub-screens that belong to a parent tab
const SCREEN_PARENT: Partial<Record<string, string>> = {
  equipment: 'farm',
  'unit-detail': 'farm',
  market: 'market',
}

export function BottomNav() {
  const activeScreen = useGameStore((s) => s.activeScreen)
  const setScreen = useGameStore((s) => s.setScreen)

  const activeTab = SCREEN_PARENT[activeScreen] ?? activeScreen

  return (
    <nav className={styles.nav}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
          onClick={() => setScreen(tab.id)}
        >
          <span className={styles.icon}>{tab.icon}</span>
          <span className={styles.label}>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
