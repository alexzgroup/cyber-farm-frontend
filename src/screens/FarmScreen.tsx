import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { PhaserGame } from '../game/PhaserGame'
import { HUD } from '../components/HUD'
import styles from './FarmScreen.module.css'

const ZOOM_STEP = 0.22

function fireZoom(delta: number) {
  document.querySelector('canvas')
    ?.dispatchEvent(new CustomEvent('farm-zoom', { detail: { delta } }))
}

function fireReset() {
  document.querySelector('canvas')
    ?.dispatchEvent(new CustomEvent('farm-reset-view'))
}

export function FarmScreen() {
  const setScreen = useGameStore((s) => s.setScreen)
  const [zoomPct, setZoomPct] = useState(100)

  useEffect(() => {
    const handler = (e: Event) => {
      const zoom = (e as CustomEvent<{ zoom: number }>).detail.zoom
      setZoomPct(Math.round(zoom * 100))
    }
    document.addEventListener('farm-zoom-changed', handler)
    return () => document.removeEventListener('farm-zoom-changed', handler)
  }, [])

  return (
    <div className={styles.wrap}>
      <HUD />
      <button className={styles.equipBtn} onClick={() => setScreen('equipment')}>
        ⚙ Оборудование
      </button>

      {/* Zoom controls */}
      <div className={styles.zoomControls}>
        <button className={styles.zoomBtn} onClick={() => fireZoom(+ZOOM_STEP)} title="Приблизить">+</button>
        <button
          className={`${styles.zoomBtn} ${styles.zoomReset}`}
          onClick={fireReset}
          title="Сбросить вид"
        >
          <span className={styles.zoomPct}>{zoomPct}%</span>
          <span className={styles.zoomIcon}>⊙</span>
        </button>
        <button className={styles.zoomBtn} onClick={() => fireZoom(-ZOOM_STEP)} title="Отдалить">−</button>
      </div>

      <PhaserGame />
    </div>
  )
}
