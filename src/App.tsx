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
import { NAV_HEIGHT } from './layout'

export function App() {
  const screen = useGameStore((s) => s.activeScreen)

  useEffect(() => {
    const id = setInterval(() => {
      const store = useGameStore.getState()
      store.tickPassiveIncome()
      store.tickEnergyRegen()
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0d1117' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: NAV_HEIGHT, overflow: 'hidden' }}>
        {screen === 'farm'       && <FarmScreen />}
        {screen === 'shop'       && <ShopScreen />}
        {screen === 'raids'      && <RaidsScreen />}
        {screen === 'market'     && <MarketScreen />}
        {screen === 'equipment'  && <EquipmentScreen />}
        {screen === 'unit-detail' && <UnitDetailScreen />}
        {screen === 'profile'    && <PlaceholderScreen title="Профиль" description="Статистика и TON-кошелёк — скоро" icon="👤" />}
      </div>
      <BottomNav />
    </div>
  )
}
