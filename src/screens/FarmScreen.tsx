import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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

function fireResetPositions() {
  document.querySelector('canvas')
    ?.dispatchEvent(new CustomEvent('farm-reset-positions'))
}

export function FarmScreen() {
  const { t } = useTranslation()
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
        {t('farm.equipment')}
      </button>
      <button className={styles.contestBtn} onClick={() => setScreen('contest')}>
        {t('contest.farmBtn')}
      </button>

      {/* Earn-gold shortcut — gold circle above the FAQ button. Opens Tasks. */}
      <button
        className={styles.tasksBtn}
        onClick={() => setScreen('tasks')}
        aria-label={t('tasks.title')}
        title={t('tasks.title')}
      >$</button>

      {/* Floating help button — bottom-right above the bottom nav. Opens the FAQ. */}
      <button
        className={styles.faqBtn}
        onClick={() => setScreen('faq')}
        aria-label={t('faq.title')}
        title={t('faq.title')}
      >?</button>

      {/* Zoom controls */}
      <div className={styles.zoomControls}>
        <button className={styles.zoomBtn} onClick={() => fireZoom(+ZOOM_STEP)} {...{title: t('farm.zoomIn')}}>+</button>
        <button
          className={`${styles.zoomBtn} ${styles.zoomReset}`}
          onClick={fireReset}
          {...{title: t('farm.resetView')}}
        >
          <span className={styles.zoomPct}>{zoomPct}%</span>
          <span className={styles.zoomIcon}>⊙</span>
        </button>
        <button className={styles.zoomBtn} onClick={() => fireZoom(-ZOOM_STEP)} {...{title: t('farm.zoomOut')}}>−</button>
        <button
          className={styles.resetPosBtn}
          onClick={fireResetPositions}
          title="Сбросить позиции юнитов"
        >⌂</button>
      </div>

      <PhaserGame />
    </div>
  )
}
