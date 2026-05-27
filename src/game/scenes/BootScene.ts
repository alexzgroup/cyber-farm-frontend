import Phaser from 'phaser'
import { FarmScene } from './FarmScene'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {
    // Draw assets programmatically — no external files needed for MVP
  }

  create() {
    // Generate drone texture programmatically
    const droneGfx = this.make.graphics({ x: 0, y: 0, add: false })

    // Body
    droneGfx.fillStyle(0x00e5ff, 1)
    droneGfx.fillRoundedRect(10, 20, 44, 28, 8)

    // Cockpit
    droneGfx.fillStyle(0x001f3d, 0.9)
    droneGfx.fillEllipse(32, 28, 20, 14)

    // Arms
    droneGfx.fillStyle(0x0077aa, 1)
    droneGfx.fillRect(0, 22, 12, 5)
    droneGfx.fillRect(52, 22, 12, 5)

    // Propellers
    droneGfx.fillStyle(0x39ff14, 1)
    droneGfx.fillEllipse(6, 20, 18, 6)
    droneGfx.fillEllipse(58, 20, 18, 6)

    // Glow ring
    droneGfx.lineStyle(2, 0x00e5ff, 0.4)
    droneGfx.strokeEllipse(32, 34, 60, 20)

    droneGfx.generateTexture('drone', 64, 64)
    droneGfx.destroy()

    // Broken drone (red tint)
    const brokenGfx = this.make.graphics({ x: 0, y: 0, add: false })
    brokenGfx.fillStyle(0xff4444, 1)
    brokenGfx.fillRoundedRect(10, 20, 44, 28, 8)
    brokenGfx.fillStyle(0x220000, 0.9)
    brokenGfx.fillEllipse(32, 28, 20, 14)
    brokenGfx.fillStyle(0x882222, 1)
    brokenGfx.fillRect(0, 22, 12, 5)
    brokenGfx.fillRect(52, 22, 12, 5)
    brokenGfx.fillStyle(0xff8800, 1)
    brokenGfx.fillEllipse(6, 20, 18, 6)
    brokenGfx.fillEllipse(58, 20, 18, 6)
    brokenGfx.generateTexture('drone_broken', 64, 64)
    brokenGfx.destroy()

    // Particle (coin)
    const coinGfx = this.make.graphics({ x: 0, y: 0, add: false })
    coinGfx.fillStyle(0xffd700, 1)
    coinGfx.fillCircle(8, 8, 8)
    coinGfx.fillStyle(0xffaa00, 1)
    coinGfx.fillCircle(8, 8, 5)
    coinGfx.generateTexture('coin_particle', 16, 16)
    coinGfx.destroy()

    this.scene.start('FarmScene')
  }
}
