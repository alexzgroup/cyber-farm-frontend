import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { RaidScene } from './scenes/RaidScene'
import type { RaidResult } from '../store/gameStore'
import { NAV_HEIGHT } from '../layout'

interface RaidGameProps {
  result: RaidResult
  onComplete: () => void
}

export function RaidGame({ result, onComplete }: RaidGameProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef      = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    const w = containerRef.current.clientWidth  || window.innerWidth
    const h = containerRef.current.clientHeight || window.innerHeight - NAV_HEIGHT

    const scene = new RaidScene()
    scene.setRaidData({ result, onComplete })

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      width: w,
      height: h,
      backgroundColor: '#0d1117',
      parent: containerRef.current,
      scene: [scene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.NO_CENTER,
      },
    })

    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [])

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
}
