import Phaser from 'phaser'
import type { RaidResult } from '../../store/gameStore'
import { paintDrone } from '../utils/droneGraphics'
import { soundManager } from '../utils/soundManager'

export interface RaidSceneData {
  result: RaidResult
  onComplete: () => void
}

export class RaidScene extends Phaser.Scene {
  private raidData: RaidSceneData | null = null

  constructor() {
    super({ key: 'RaidScene' })
  }

  setRaidData(d: RaidSceneData) {
    this.raidData = d
  }

  create() {
    if (!this.raidData) return
    const { width, height } = this.scale
    const { result } = this.raidData

    this.generateTextures()
    this.drawBackground(width, height)

    const droneY  = height * 0.44
    const turretX = width * 0.76
    const turretY = droneY + 10

    // Ground platform under turret
    const platform = this.add.graphics()
    platform.fillStyle(0x330a0a, 1)
    platform.fillRoundedRect(turretX - 56, height * 0.54, 112, 14, 3)
    platform.lineStyle(2, 0xff3300, 0.45)
    platform.lineBetween(turretX - 56, height * 0.54, turretX + 56, height * 0.54)
    platform.lineStyle(1, 0xff3300, 0.15)
    platform.lineBetween(turretX - 56, height * 0.54 + 5, turretX + 56, height * 0.54 + 5)

    const drone  = this.add.image(width * 0.12, droneY, 'raid_drone').setScale(0.78)
    const turret = this.add.image(turretX, turretY, 'raid_turret').setScale(0.78)

    // Warning glow behind turret
    const warnGlow = this.add.graphics()
    warnGlow.fillStyle(0xff2200, 0.08)
    warnGlow.fillEllipse(turretX, turretY, 140, 80)

    this.add.text(turretX, droneY - 68, result.targetName, {
      fontSize: '13px', fontFamily: 'monospace', color: '#ff5555',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5)

    this.add.text(width * 0.12, droneY - 68, 'Ты', {
      fontSize: '13px', fontFamily: 'monospace', color: '#00e5ff',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5)

    // Drone flies toward turret
    this.tweens.add({
      targets: drone,
      x: result.won ? turretX - 28 : width * 0.5,
      duration: 1700,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.time.delayedCall(80, () =>
          this.playCollision(drone, turretX, droneY, result, width, height)
        )
      },
    })

    // Turret fires laser after 650ms
    this.time.delayedCall(650, () => {
      this.fireLaser(turretX - 52, droneY + 4, result.won, width)
    })

    // Turret warning light pulses
    this.time.addEvent({
      delay: 280,
      repeat: 5,
      callback: () => {
        warnGlow.clear()
        warnGlow.fillStyle(0xff2200, Math.random() * 0.12 + 0.04)
        warnGlow.fillEllipse(turretX, turretY, 140, 80)
      },
    })
  }

  private fireLaser(fromX: number, y: number, playerWins: boolean, sceneW: number) {
    const toX = playerWins ? fromX - 160 : sceneW * 0.44

    // Animated bolt: tween a plain object and redraw each frame
    const bolt = this.add.graphics()
    const state = { headX: fromX }

    const redraw = () => {
      bolt.clear()
      const tailX = Math.min(state.headX + 50, fromX)
      // Outer glow
      bolt.lineStyle(7, 0xff2200, 0.22)
      bolt.lineBetween(tailX, y, state.headX, y)
      // Core beam
      bolt.lineStyle(2.5, 0xff6600, 1)
      bolt.lineBetween(tailX, y, state.headX, y)
      // Bright tip
      bolt.fillStyle(0xffee44, 1)
      bolt.fillCircle(state.headX, y, 4)
      bolt.fillStyle(0xffffff, 0.8)
      bolt.fillCircle(state.headX, y, 2)
    }

    soundManager.laser()
    redraw()

    this.tweens.add({
      targets: state,
      headX: toX,
      duration: 750,
      ease: 'Linear',
      onUpdate: redraw,
      onComplete: () => bolt.destroy(),
    })
  }

  private playCollision(
    drone: Phaser.GameObjects.Image,
    turretX: number,
    droneY: number,
    result: RaidResult,
    w: number,
    h: number,
  ) {
    const cx = result.won ? turretX : drone.x
    this.spawnExplosion(cx, droneY, result.won ? 0xff8800 : 0x00e5ff)

    if (result.won) {
      // Turret takes the hit — shake and fade
      this.tweens.add({
        targets: drone,
        alpha: 0,
        duration: 200,
        yoyo: true,
        repeat: 2,
        onComplete: () => drone.setAlpha(1),
      })
    } else {
      // Drone shot down
      this.tweens.add({
        targets: drone,
        alpha: 0,
        angle: 90,
        y: droneY + 70,
        duration: 500,
      })
    }

    this.time.delayedCall(700, () => this.showResult(result, w, h))
  }

  private spawnExplosion(x: number, y: number, color: number) {
    soundManager.explosion()
    // Expanding rings
    for (let i = 0; i < 4; i++) {
      const ring = this.add.graphics()
      ring.lineStyle(3 - i * 0.5, color, 1)
      ring.strokeCircle(0, 0, 8)
      ring.x = x
      ring.y = y
      this.tweens.add({
        targets: ring,
        scaleX: 5 + i * 1.5,
        scaleY: 5 + i * 1.5,
        alpha: 0,
        duration: 600 + i * 100,
        delay: i * 70,
        ease: 'Cubic.Out',
        onComplete: () => ring.destroy(),
      })
    }
    // Sparks
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2
      const dist  = 45 + Math.random() * 35
      const spark = this.add.graphics()
      spark.fillStyle(color, 1)
      spark.fillCircle(0, 0, 2.5 + Math.random() * 2)
      spark.x = x
      spark.y = y
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        duration: 450 + Math.random() * 200,
        ease: 'Cubic.Out',
        onComplete: () => spark.destroy(),
      })
    }
    // Flash
    const flash = this.add.graphics()
    flash.fillStyle(0xffffff, 0.6)
    flash.fillCircle(x, y, 30)
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 2.5,
      scaleY: 2.5,
      duration: 200,
      onComplete: () => flash.destroy(),
    })
  }

  private showResult(result: RaidResult, w: number, h: number) {
    // Dark overlay
    const overlay = this.add.graphics()
    overlay.fillStyle(0x000000, 0)
    overlay.fillRect(0, 0, w, h)
    this.tweens.add({ targets: overlay, alpha: 0.55, duration: 380 })

    // Result card background
    const cardY = h * 0.36
    const card  = this.add.graphics().setAlpha(0)
    card.lineStyle(1.5, result.won ? 0x39ff14 : 0xff4444, 0.7)
    card.fillStyle(result.won ? 0x001a00 : 0x1a0000, 0.92)
    card.fillRoundedRect(w / 2 - 110, cardY - 20, 220, 140, 10)
    card.strokeRoundedRect(w / 2 - 110, cardY - 20, 220, 140, 10)
    this.tweens.add({ targets: card, alpha: 1, duration: 320 })

    // Win/lose text
    const resultText = this.add.text(
      w / 2, cardY + 18,
      result.won ? '✓  ПОБЕДА' : '✗  ПОРАЖЕНИЕ',
      {
        fontSize: '28px', fontFamily: 'monospace', fontStyle: 'bold',
        color: result.won ? '#39ff14' : '#ff4444',
        stroke: '#000', strokeThickness: 4,
      }
    ).setOrigin(0.5).setAlpha(0).setScale(0.4)

    this.tweens.add({
      targets: resultText,
      alpha: 1, scaleX: 1, scaleY: 1,
      duration: 380,
      ease: 'Back.Out',
    })

    // Sub-text
    const subText = this.add.text(
      w / 2, cardY + 56,
      result.won ? `+${result.amount} монет украдено` : 'Дрон повреждён',
      {
        fontSize: '15px', fontFamily: 'monospace',
        color: result.won ? '#88ff88' : '#ff9999',
      }
    ).setOrigin(0.5).setAlpha(0)

    this.time.delayedCall(280, () => {
      this.tweens.add({ targets: subText, alpha: 1, duration: 300 })

      // Continue button
      this.time.delayedCall(500, () => {
        const btn = this.add.text(w / 2, cardY + 96, 'Продолжить  →', {
          fontSize: '14px', fontFamily: 'monospace', color: '#00e5ff',
          backgroundColor: '#00e5ff18',
          padding: { x: 18, y: 8 },
        }).setOrigin(0.5).setAlpha(0).setInteractive({ useHandCursor: true })

        this.tweens.add({ targets: btn, alpha: 1, duration: 250 })
        btn.on('pointerdown', () => this.raidData?.onComplete())
        btn.on('pointerover',  () => btn.setStyle({ color: '#ffffff', backgroundColor: '#00e5ff33' }))
        btn.on('pointerout',   () => btn.setStyle({ color: '#00e5ff', backgroundColor: '#00e5ff18' }))
      })
    })
  }

  private drawBackground(w: number, h: number) {
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x0d0810, 0x0d0810, 0x1a0505, 0x1a0505, 1)
    bg.fillRect(0, 0, w, h)

    // Ground
    bg.fillStyle(0x1a0404, 1)
    bg.fillRect(0, h * 0.57, w, h * 0.43)
    bg.lineStyle(2, 0xff3300, 0.3)
    bg.lineBetween(0, h * 0.57, w, h * 0.57)

    // Hex grid (sparse)
    const grid = this.add.graphics()
    grid.lineStyle(1, 0xff3300, 0.05)
    for (let x = 0; x < w; x += 38) grid.lineBetween(x, 0, x, h)
    for (let y = 0; y < h; y += 38) grid.lineBetween(0, y, w, y)

    // Distant city silhouette (simple boxes)
    const city = this.add.graphics()
    city.fillStyle(0x220505, 1)
    const buildings = [
      { x: 10, w: 28, h: 55 }, { x: 44, w: 20, h: 35 }, { x: 70, w: 32, h: 70 },
      { x: 108, w: 18, h: 42 }, { x: 132, w: 26, h: 60 }, { x: 164, w: 16, h: 28 },
      { x: 200, w: 36, h: 80 }, { x: 242, w: 22, h: 48 }, { x: 270, w: 30, h: 55 },
      { x: 306, w: 20, h: 38 }, { x: 332, w: 40, h: 65 }, { x: 378, w: 18, h: 44 },
    ]
    const groundLine = h * 0.57
    buildings.forEach((b) => {
      city.fillRect(b.x, groundLine - b.h, b.w, b.h)
    })
    // Tiny window lights
    city.fillStyle(0xff4400, 0.4)
    buildings.forEach((b) => {
      city.fillRect(b.x + 4, groundLine - b.h + 8, 4, 4)
      if (b.w > 24) city.fillRect(b.x + b.w - 10, groundLine - b.h + 16, 4, 4)
    })
  }

  private generateTextures() {
    if (this.textures.exists('raid_drone')) return  // already generated in this session

    // Drone (reuse same painting logic)
    const dg = this.make.graphics({ x: 0, y: 0, add: false })
    paintDrone(dg, false)
    dg.generateTexture('raid_drone', 128, 128)
    dg.destroy()

    // Fortress turret (128×128, gun barrels face LEFT)
    const tg = this.make.graphics({ x: 0, y: 0, add: false })

    // Base platform
    tg.fillStyle(0x220505, 1)
    tg.fillRect(6, 96, 116, 26)
    tg.lineStyle(2, 0xff2200, 0.4)
    tg.lineBetween(6, 96, 122, 96)

    // Platform armored slabs
    tg.fillStyle(0x330808, 1)
    tg.fillRect(8, 98, 34, 20)
    tg.fillRect(46, 98, 34, 20)
    tg.fillRect(84, 98, 34, 20)
    tg.lineStyle(1, 0xff4400, 0.12)
    tg.lineBetween(42, 98, 42, 118)
    tg.lineBetween(80, 98, 80, 118)

    // Tower body depth
    tg.fillStyle(0x3a0808, 1)
    tg.fillRect(20, 42, 88, 58)

    // Tower body face
    tg.fillStyle(0x5a0e0e, 1)
    tg.fillRect(20, 36, 88, 60)

    // Side armour panels
    tg.fillStyle(0x480c0c, 1)
    tg.fillRect(20, 36, 14, 60)
    tg.fillRect(94, 36, 14, 60)
    tg.lineStyle(1, 0xff5555, 0.14)
    tg.lineBetween(21, 40, 21, 94)
    tg.lineBetween(34, 40, 34, 94)

    // Fortress cap (battlements)
    tg.fillStyle(0x6e1212, 1)
    tg.fillRoundedRect(16, 20, 96, 22, 4)
    tg.fillStyle(0x881818, 1)
    tg.fillRoundedRect(16, 14, 96, 18, 4)

    // Warning stripes on cap
    tg.fillStyle(0xff3300, 0.55)
    tg.fillRect(20, 15, 16, 8)
    tg.fillRect(54, 15, 16, 8)
    tg.fillRect(88, 15, 16, 8)

    // Battlements (notches on cap top)
    tg.fillStyle(0x3a0808, 1)
    tg.fillRect(22, 10, 12, 8)
    tg.fillRect(58, 10, 12, 8)
    tg.fillRect(94, 10, 12, 8)

    // Gun barrels (pointing LEFT)
    tg.fillStyle(0x1a1a1a, 1)
    tg.fillRoundedRect(0, 42, 36, 12, 3)
    tg.fillStyle(0x333333, 1)
    tg.fillRoundedRect(0, 43, 34, 6, 2)

    tg.fillStyle(0x181818, 1)
    tg.fillRoundedRect(0, 60, 30, 10, 3)
    tg.fillStyle(0x2e2e2e, 1)
    tg.fillRoundedRect(0, 61, 28, 5, 2)

    // Muzzle rings
    tg.lineStyle(2, 0xff3300, 0.55)
    tg.strokeCircle(4, 48, 6)
    tg.strokeCircle(4, 65, 5)

    // Warning lights on cap
    tg.fillStyle(0xff0000, 1)
    tg.fillCircle(28, 20, 5)
    tg.fillStyle(0xff0000, 0.3)
    tg.fillCircle(28, 20, 9)

    tg.fillStyle(0xff8800, 1)
    tg.fillCircle(100, 20, 4)
    tg.fillStyle(0xff8800, 0.25)
    tg.fillCircle(100, 20, 7)

    // Radar dish (right side)
    tg.fillStyle(0x282828, 1)
    tg.fillEllipse(104, 58, 22, 30)
    tg.fillStyle(0x383838, 1)
    tg.fillEllipse(104, 57, 15, 21)
    tg.lineStyle(1, 0xff4444, 0.4)
    tg.lineBetween(104, 48, 104, 66)
    tg.lineBetween(95, 57, 113, 57)

    // Energy core (glowing center)
    tg.fillStyle(0x880000, 0.9)
    tg.fillCircle(64, 62, 10)
    tg.fillStyle(0xff2200, 0.6)
    tg.fillCircle(64, 62, 6)
    tg.fillStyle(0xff8800, 0.8)
    tg.fillCircle(64, 62, 3)
    tg.lineStyle(1, 0xff4400, 0.5)
    tg.strokeCircle(64, 62, 14)

    tg.generateTexture('raid_turret', 128, 128)
    tg.destroy()
  }
}
