import { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { UnitPreviewScene, type UnitPreviewData } from './scenes/UnitPreviewScene'

interface Props {
  unit: UnitPreviewData
  width?: number
  height?: number
}

export function UnitPreviewGame({ unit, width = 300, height = 260 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef      = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    const scene = new UnitPreviewScene()
    scene.setUnitData(unit)

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      width,
      height,
      backgroundColor: '#0a0f1a',
      parent: containerRef.current,
      scene: [scene],
      scale: { mode: Phaser.Scale.NONE },
    })

    return () => {
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [unit.kind, unit.droneType, unit.turretLevel, unit.isBroken])

  return (
    <div
      ref={containerRef}
      style={{ width, height, borderRadius: 12, overflow: 'hidden' }}
    />
  )
}
