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
      {/* Bottom-left action row — Konkurs (gold pill) + Oborudovanie (blue pill).
          Styles ported from assets/ferma-3d/index.html. */}
      <div className={styles.actions}>
        <button className={`${styles.act} ${styles.actContest}`} onClick={() => setScreen('contest')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 3h12v3h3v2a4 4 0 0 1-4 4h-.4A6 6 0 0 1 13 17.9V20h3v2H8v-2h3v-2.1A6 6 0 0 1 7.4 15H7a4 4 0 0 1-4-4V6h3V3Zm0 5H5v3a2 2 0 0 0 2 2V8Zm12 5a2 2 0 0 0 2-2V8h-2v5Z"/>
          </svg>
          {t('contest.farmBtn')}
        </button>
        <button className={`${styles.act} ${styles.actGear}`} onClick={() => setScreen('equipment')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>
          </svg>
          {t('farm.equipment')}
        </button>
      </div>

      {/* Bottom-right FABs — $ (Tasks) above ? (FAQ). Radial gradient circles. */}
      <div className={styles.fabs}>
        <button
          className={`${styles.fab} ${styles.fabMoney}`}
          onClick={() => setScreen('tasks')}
          aria-label={t('tasks.title')}
          title={t('tasks.title')}
        >$</button>
        <button
          className={`${styles.fab} ${styles.fabHelp}`}
          onClick={() => setScreen('faq')}
          aria-label={t('faq.title')}
          title={t('faq.title')}
        >?</button>
      </div>

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
