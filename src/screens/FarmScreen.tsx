import { useRef, useEffect, useState } from 'react'
import { PhaserGame } from '../game/PhaserGame'
import { HUD } from '../components/HUD'

export function FarmScreen() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 390, height: 600 })

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <HUD />
      <PhaserGame width={size.width} height={size.height} />
    </div>
  )
}
