import { useEffect } from 'react'
import { useGameStore } from './store/gameStore'
import { BottomNav } from './components/BottomNav'
import { FarmScreen } from './screens/FarmScreen'
import { ShopScreen } from './screens/ShopScreen'
import { RaidsScreen } from './screens/RaidsScreen'
import { EquipmentScreen } from './screens/EquipmentScreen'
import { UnitDetailScreen } from './screens/UnitDetailScreen'
import { MarketScreen } from './screens/MarketScreen'
import { PlaceholderScreen } from './screens/PlaceholderScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { NAV_HEIGHT } from './layout'

export function App() {
  const screen      = useGameStore((s) => s.activeScreen)
  const isLoaded    = useGameStore((s) => s.isLoaded)
  const loadError   = useGameStore((s) => s.loadError)
  const loadGameState = useGameStore((s) => s.loadGameState)

  // Load game state from API on mount
  useEffect(() => {
    loadGameState()
  }, [loadGameState])

  // Energy regen tick — runs every second regardless of load state
  useEffect(() => {
    const id = setInterval(() => {
      useGameStore.getState().tickEnergyRegen()
    }, 1000)
    return () => clearInterval(id)
  }, [])

  if (!isLoaded) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: '#0d1117', color: '#06b6d4', fontSize: 18,
      }}>
        Loading…
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#0d1117', color: '#f87171', gap: 12, padding: 24,
      }}>
        <span>Failed to load game data</span>
        <span style={{ fontSize: 13, opacity: 0.6 }}>{loadError}</span>
        <button
          style={{ marginTop: 8, padding: '8px 20px', background: '#06b6d4', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          onClick={loadGameState}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0d1117' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: NAV_HEIGHT, overflow: 'hidden' }}>
        {screen === 'farm'        && <FarmScreen />}
        {screen === 'shop'        && <ShopScreen />}
        {screen === 'raids'       && <RaidsScreen />}
        {screen === 'market'      && <MarketScreen />}
        {screen === 'equipment'   && <EquipmentScreen />}
        {screen === 'unit-detail' && <UnitDetailScreen />}
        {screen === 'profile'     && <ProfileScreen />}
      </div>
      <BottomNav />
    </div>
  )
}
