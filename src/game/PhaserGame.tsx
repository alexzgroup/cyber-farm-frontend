import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { FarmScene } from './scenes/FarmScene'

interface PhaserGameProps {
  width: number
  height: number
}

export function PhaserGame({ width, height }: PhaserGameProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      width,
      height,
      backgroundColor: '#0d1117',
      parent: containerRef.current,
      scene: [BootScene, FarmScene],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      render: {
        antialias: true,
        pixelArt: false,
      },
      dom: { createContainer: false },
    })

    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [width, height])

  return (
    <div
      ref={containerRef}
      style={{ width, height, position: 'absolute', top: 0, left: 0 }}
    />
  )
}
