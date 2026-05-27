import { useGameStore } from './store/gameStore'
import { BottomNav } from './components/BottomNav'
import { FarmScreen } from './screens/FarmScreen'
import { PlaceholderScreen } from './screens/PlaceholderScreen'

export function App() {
  const screen = useGameStore((s) => s.activeScreen)

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0d1117' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 60, overflow: 'hidden' }}>
        {screen === 'farm'    && <FarmScreen />}
        {screen === 'shop'    && <PlaceholderScreen title="Магазин" description="Апгрейды для дронов — скоро" icon="🛒" />}
        {screen === 'raids'   && <PlaceholderScreen title="PvP-рейды" description="Атакуй фермы других игроков — скоро" icon="⚔️" />}
        {screen === 'profile' && <PlaceholderScreen title="Профиль" description="Статистика и TON-кошелёк — скоро" icon="👤" />}
      </div>
      <BottomNav />
    </div>
  )
}
