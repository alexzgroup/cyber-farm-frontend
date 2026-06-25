import { useEffect, useRef } from 'react'

const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#00e5ff', '#39ff14']
const PARTICLE_COUNT = 120
const GRAVITY = 0.35
const DURATION_MS = 3500

interface Particle {
  x: number; y: number; vx: number; vy: number
  w: number; h: number; angle: number; spin: number; color: string; alpha: number
}

function makeParticles(w: number): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    x:     Math.random() * w,
    y:     -20,
    vx:    (Math.random() - 0.5) * 6,
    vy:    Math.random() * 4 + 2,
    w:     Math.random() * 10 + 6,
    h:     Math.random() * 6 + 4,
    angle: Math.random() * Math.PI * 2,
    spin:  (Math.random() - 0.5) * 0.3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    alpha: 1,
  }))
}

export function Confetti({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight

    const particles = makeParticles(canvas.width)
    let raf: number
    const start = performance.now()

    const frame = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / DURATION_MS, 1)

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const p of particles) {
        p.x     += p.vx
        p.vy    += GRAVITY
        p.y     += p.vy
        p.angle += p.spin
        p.alpha  = Math.max(0, 1 - progress * 1.4)

        ctx.save()
        ctx.globalAlpha = p.alpha
        ctx.translate(p.x, p.y)
        ctx.rotate(p.angle)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }

      if (progress < 1) {
        raf = requestAnimationFrame(frame)
      } else {
        onDone()
      }
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [onDone])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        pointerEvents: 'none', width: '100%', height: '100%',
      }}
    />
  )
}
