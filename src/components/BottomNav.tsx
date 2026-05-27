import { useGameStore, Screen } from '../store/gameStore'
import styles from './BottomNav.module.css'

const TABS: { id: Screen; icon: string; label: string }[] = [
  { id: 'farm',    icon: '⚡', label: 'Ферма'   },
  { id: 'shop',    icon: '🛒', label: 'Магазин' },
  { id: 'raids',   icon: '⚔️',  label: 'Рейды'   },
  { id: 'profile', icon: '👤', label: 'Профиль' },
]

export function BottomNav() {
  const activeScreen = useGameStore((s) => s.activeScreen)
  const setScreen = useGameStore((s) => s.setScreen)

  return (
    <nav className={styles.nav}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`${styles.tab} ${activeScreen === tab.id ? styles.active : ''}`}
          onClick={() => setScreen(tab.id)}
        >
          <span className={styles.icon}>{tab.icon}</span>
          <span className={styles.label}>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
