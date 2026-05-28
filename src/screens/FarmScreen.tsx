import { PhaserGame } from '../game/PhaserGame'
import { HUD } from '../components/HUD'

export function FarmScreen() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <HUD />
      <PhaserGame />
    </div>
  )
}
