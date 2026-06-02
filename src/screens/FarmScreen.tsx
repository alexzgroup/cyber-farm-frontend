import { useGameStore } from '../store/gameStore'
import { PhaserGame } from '../game/PhaserGame'
import { HUD } from '../components/HUD'
import styles from './FarmScreen.module.css'

export function FarmScreen() {
  const setScreen = useGameStore((s) => s.setScreen)

  return (
    <div className={styles.wrap}>
      <HUD />
      <button className={styles.equipBtn} onClick={() => setScreen('equipment')}>
        ⚙ Оборудование
      </button>
      <PhaserGame />
    </div>
  )
}
