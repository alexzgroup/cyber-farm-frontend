import Phaser from 'phaser'
import { paintDrone, paintFarmTurret } from '../utils/droneGraphics'

export interface UnitPreviewData {
  kind: 'drone' | 'turret'
  droneType?: 1 | 2 | 3
  droneLevel?: number
  turretLevel?: 1 | 2 | 3
  isBroken?: boolean
}

const GLOW_COLORS: Record<string, number> = {
  drone_1: 0x00e5ff,
  drone_2: 0xff4400,
  drone_3: 0xcc00ff,
  turret_1: 0x00cc44,
  turret_2: 0xffaa00,
  turret_3: 0xff4400,
}

export class UnitPreviewScene extends Phaser.Scene {
  private unitData: UnitPreviewData | null = null

  constructor() {
    super({ key: 'UnitPreviewScene' })
  }

  setUnitData(d: UnitPreviewData) {
    this.unitData = d
  }

  create() {
    if (!this.unitData) return
    const W = this.scale.width
    const H = this.scale.height
    const { kind, droneType = 1, turretLevel = 1, isBroken = false } = this.unitData

    // Background
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x0a0f1a, 0x0a0f1a, 0x050a12, 0x050a12, 1)
    bg.fillRect(0, 0, W, H)

    // Grid
    const grid = this.add.graphics()
    grid.lineStyle(1, 0x00e5ff, 0.06)
    for (let x = 0; x < W; x += 32) grid.lineBetween(x, 0, x, H)
    for (let y = 0; y < H; y += 32) grid.lineBetween(0, y, W, y)

    // Generate texture
    const texKey = kind === 'drone' ? `preview_drone_${droneType}` : `preview_turret_${turretLevel}`

    if (!this.textures.exists(texKey)) {
      const g = this.make.graphics({ x: 0, y: 0, add: false })
      if (kind === 'drone') {
        paintDrone(g, isBroken, droneType as 1 | 2 | 3)
      } else {
        paintFarmTurret(g, turretLevel)
      }
      g.generateTexture(texKey, 128, 128)
      g.destroy()
    }

    const colorKey = kind === 'drone' ? `drone_${droneType}` : `turret_${turretLevel}`
    const glowColor = GLOW_COLORS[colorKey] ?? 0x00e5ff

    // Outer glow ring (pulsing)
    const glowRing = this.add.graphics()
    const cx = W / 2, cy = H / 2

    this.time.addEvent({
      delay: 40, repeat: -1,
      callback: () => {
        glowRing.clear()
        const pulse = 0.06 + 0.04 * Math.sin(this.time.now * 0.003)
        glowRing.fillStyle(glowColor, pulse)
        glowRing.fillCircle(cx, cy, 90)
        glowRing.fillStyle(glowColor, pulse * 0.5)
        glowRing.fillCircle(cx, cy, 120)
      },
    })

    // Orbit particles
    for (let i = 0; i < 6; i++) {
      const orb = this.add.graphics()
      orb.fillStyle(glowColor, 0.7)
      orb.fillCircle(0, 0, 3)
      orb.x = cx; orb.y = cy

      const angle = (i / 6) * Math.PI * 2
      const radius = 75 + Math.random() * 20
      const speed = 0.0008 + Math.random() * 0.0004
      const startAngle = angle

      this.time.addEvent({
        delay: 16, repeat: -1,
        callback: () => {
          const a = startAngle + this.time.now * speed
          orb.x = cx + Math.cos(a) * radius
          orb.y = cy + Math.sin(a) * (radius * 0.45)
          orb.setAlpha(0.4 + 0.3 * Math.sin(a * 2))
        },
      })
    }

    // Unit sprite — large
    const scale = kind === 'drone' ? 2.4 : 2.0
    const sprite = this.add.image(cx, cy, texKey).setScale(scale)

    // Hover animation
    this.tweens.add({
      targets: sprite,
      y: cy - 12,
      duration: 1600,
      yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Slow spin for drones
    if (kind === 'drone') {
      this.tweens.add({
        targets: sprite,
        angle: 4,
        duration: 2200,
        yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    // Corner accents
    this.drawCornerAccents(W, H, glowColor)
  }

  private drawCornerAccents(W: number, H: number, color: number) {
    const acc = this.add.graphics()
    acc.lineStyle(1.5, color, 0.4)
    const sz = 20
    // Top-left
    acc.lineBetween(8, 8, 8 + sz, 8)
    acc.lineBetween(8, 8, 8, 8 + sz)
    // Top-right
    acc.lineBetween(W - 8, 8, W - 8 - sz, 8)
    acc.lineBetween(W - 8, 8, W - 8, 8 + sz)
    // Bottom-left
    acc.lineBetween(8, H - 8, 8 + sz, H - 8)
    acc.lineBetween(8, H - 8, 8, H - 8 - sz)
    // Bottom-right
    acc.lineBetween(W - 8, H - 8, W - 8 - sz, H - 8)
    acc.lineBetween(W - 8, H - 8, W - 8, H - 8 - sz)
  }
}
