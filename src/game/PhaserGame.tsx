import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { FarmScene } from './scenes/FarmScene'
import { NAV_HEIGHT } from '../layout'

export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    // Use measured container size; fall back to window if CSS layout not yet computed
    const w = containerRef.current.clientWidth  || window.innerWidth
    const h = containerRef.current.clientHeight || window.innerHeight - NAV_HEIGHT

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      width: w,
      height: h,
      backgroundColor: '#0d1117',
      parent: containerRef.current,
      scene: [BootScene, FarmScene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.NO_CENTER,
      },
      render: {
        antialias: true,
        pixelArt: false,
      },
      dom: { createContainer: false },
    })

    if (import.meta.env.DEV) {
      (window as unknown as { __CF_GAME__: Phaser.Game }).__CF_GAME__ = gameRef.current
    }

    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [])

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
}
