import Phaser from 'phaser'
import type { RaidResult } from '../../store/gameStore'
import { paintDrone } from '../utils/droneGraphics'
import { soundManager } from '../utils/soundManager'

export interface RaidSceneData {
  result: RaidResult
  onComplete: () => void
}

const SQUAD_SIZE = 3

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

    // Column X positions
    const leftX  = width * 0.18
    const rightX = width * 0.82

    // Row Y positions — 3 units per side, evenly spread
    const rowYs: number[] = []
    const rowSpacing = height * 0.20
    const firstRow = height * 0.28
    for (let i = 0; i < SQUAD_SIZE; i++) rowYs.push(firstRow + i * rowSpacing)

    // Side labels
    this.add.text(leftX, rowYs[0] - 52, '▶ ТЫ', {
      fontSize: '13px', fontFamily: 'monospace', color: '#00e5ff',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5)

    this.add.text(rightX, rowYs[0] - 52, result.targetName + ' ◀', {
      fontSize: '13px', fontFamily: 'monospace', color: '#ff5555',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5)

    // Center divider
    const divider = this.add.graphics()
    divider.lineStyle(1, 0x444444, 0.4)
    divider.lineBetween(width / 2, 20, width / 2, height * 0.72)
    divider.fillStyle(0x00e5ff, 0.04)
    divider.fillRect(width / 2 - 1, 20, 2, height * 0.72 - 20)

    // VS label in center
    this.add.text(width / 2, rowYs[1], 'VS', {
      fontSize: '16px', fontFamily: 'monospace', color: '#555555',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setAlpha(0.6)

    // ── Build drone squadron (left side) ──
    const drones: Phaser.GameObjects.Image[] = []
    for (let i = 0; i < SQUAD_SIZE; i++) {
      const drone = this.add.image(leftX, rowYs[i], 'raid_drone')
        .setScale(0.62)
        .setAlpha(0)
      drones.push(drone)

      // Staggered fade-in
      this.tweens.add({ targets: drone, alpha: 1, duration: 220, delay: i * 110 })

      // Hover
      this.tweens.add({
        targets: drone,
        y: rowYs[i] - 10,
        duration: 1200 + i * 140,
        yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut',
        delay: i * 180,
      })

      // Small platform under drone
      const dp = this.add.graphics()
      dp.fillStyle(0x003322, 0.7)
      dp.fillRoundedRect(leftX - 36, rowYs[i] + 40, 72, 8, 2)
      dp.lineStyle(1, 0x00e5ff, 0.25)
      dp.lineBetween(leftX - 36, rowYs[i] + 40, leftX + 36, rowYs[i] + 40)
    }

    // ── Build turret squadron (right side) ──
    const turrets: Phaser.GameObjects.Image[] = []
    const warnGlows: Phaser.GameObjects.Graphics[] = []

    for (let i = 0; i < SQUAD_SIZE; i++) {
      // Platform under turret
      const tp = this.add.graphics()
      tp.fillStyle(0x330808, 0.8)
      tp.fillRoundedRect(rightX - 44, rowYs[i] + 40, 88, 10, 2)
      tp.lineStyle(1, 0xff3300, 0.35)
      tp.lineBetween(rightX - 44, rowYs[i] + 40, rightX + 44, rowYs[i] + 40)

      // Warning glow
      const wg = this.add.graphics()
      wg.fillStyle(0xff2200, 0.06)
      wg.fillEllipse(rightX, rowYs[i], 90, 55)
      warnGlows.push(wg)

      const turret = this.add.image(rightX, rowYs[i], 'raid_turret')
        .setScale(0.62)
        .setAlpha(0)
      turrets.push(turret)

      this.tweens.add({ targets: turret, alpha: 1, duration: 220, delay: 280 + i * 110 })
    }

    // Warn light pulse
    this.time.addEvent({
      delay: 240, repeat: 9,
      callback: () => {
        warnGlows.forEach((wg, i) => {
          wg.clear()
          wg.fillStyle(0xff2200, Math.random() * 0.12 + 0.03)
          wg.fillEllipse(rightX, rowYs[i], 90, 55)
        })
      },
    })

    // ── Battle sequence ──
    // Phase 1: Turrets fire red lasers (right → left)
    rowYs.forEach((y, i) => {
      this.time.delayedCall(700 + i * 220, () => {
        this.fireTurretLaser(rightX - 48, y, leftX + 28)
      })
    })

    // Phase 2: Drones fire blue bolts (left → right)
    rowYs.forEach((y, i) => {
      this.time.delayedCall(920 + i * 200, () => {
        this.fireDroneBolt(leftX + 38, y, rightX - 48)
      })
    })

    // Phase 3: Result explosions
    this.time.delayedCall(2400, () => {
      if (result.won) {
        // Turrets destroyed one by one
        turrets.forEach((t, i) => {
          this.time.delayedCall(i * 220, () => {
            this.spawnExplosion(t.x, t.y, 0xff8800)
            t.setVisible(false)
            warnGlows[i]?.setVisible(false)
          })
        })
      } else {
        // Drones shot down
        drones.forEach((d, i) => {
          this.time.delayedCall(i * 200, () => {
            this.spawnExplosion(d.x, d.y, 0x00e5ff)
            this.tweens.add({
              targets: d,
              alpha: 0, angle: 80, y: d.y + 55,
              duration: 420,
            })
          })
        })
      }

      this.time.delayedCall(1000, () => this.showResult(result, width, height))
    })
  }

  // Turret laser: travels RIGHT → LEFT
  private fireTurretLaser(fromX: number, y: number, toX: number) {
    const bolt = this.add.graphics()
    const state = { headX: fromX }

    const redraw = () => {
      bolt.clear()
      const tailX = Math.min(state.headX + 55, fromX)
      bolt.lineStyle(7, 0xff2200, 0.18)
      bolt.lineBetween(tailX, y, state.headX, y)
      bolt.lineStyle(2.5, 0xff6600, 1)
      bolt.lineBetween(tailX, y, state.headX, y)
      bolt.fillStyle(0xffee44, 1)
      bolt.fillCircle(state.headX, y, 4)
      bolt.fillStyle(0xffffff, 0.75)
      bolt.fillCircle(state.headX, y, 1.8)
    }

    soundManager.laser()
    redraw()

    this.tweens.add({
      targets: state, headX: toX,
      duration: 540, ease: 'Linear',
      onUpdate: redraw,
      onComplete: () => bolt.destroy(),
    })
  }

  // Drone bolt: travels LEFT → RIGHT
  private fireDroneBolt(fromX: number, y: number, toX: number) {
    const bolt = this.add.graphics()
    const state = { headX: fromX }

    const redraw = () => {
      bolt.clear()
      const tailX = Math.max(state.headX - 42, fromX)
      bolt.lineStyle(6, 0x00e5ff, 0.22)
      bolt.lineBetween(tailX, y, state.headX, y)
      bolt.lineStyle(2, 0x44ccff, 1)
      bolt.lineBetween(tailX, y, state.headX, y)
      bolt.fillStyle(0xffffff, 0.9)
      bolt.fillCircle(state.headX, y, 3.5)
    }

    redraw()

    this.tweens.add({
      targets: state, headX: toX,
      duration: 500, ease: 'Linear',
      onUpdate: redraw,
      onComplete: () => bolt.destroy(),
    })
  }

  private spawnExplosion(x: number, y: number, color: number) {
    soundManager.explosion()
    for (let i = 0; i < 4; i++) {
      const ring = this.add.graphics()
      ring.lineStyle(3 - i * 0.5, color, 1)
      ring.strokeCircle(0, 0, 8)
      ring.x = x; ring.y = y
      this.tweens.add({
        targets: ring,
        scaleX: 4.5 + i, scaleY: 4.5 + i, alpha: 0,
        duration: 520 + i * 90, delay: i * 65,
        ease: 'Cubic.Out',
        onComplete: () => ring.destroy(),
      })
    }
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2
      const dist  = 32 + Math.random() * 28
      const spark = this.add.graphics()
      spark.fillStyle(color, 1)
      spark.fillCircle(0, 0, 2 + Math.random() * 2)
      spark.x = x; spark.y = y
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        duration: 380 + Math.random() * 200,
        ease: 'Cubic.Out',
        onComplete: () => spark.destroy(),
      })
    }
    const flash = this.add.graphics()
    flash.fillStyle(0xffffff, 0.5)
    flash.fillCircle(x, y, 22)
    this.tweens.add({
      targets: flash, alpha: 0, scaleX: 2, scaleY: 2,
      duration: 170,
      onComplete: () => flash.destroy(),
    })
  }

  private showResult(result: RaidResult, w: number, h: number) {
    const overlay = this.add.graphics()
    overlay.fillStyle(0x000000, 0)
    overlay.fillRect(0, 0, w, h)
    this.tweens.add({ targets: overlay, alpha: 0.55, duration: 380 })

    const cardY = h * 0.36
    const card  = this.add.graphics().setAlpha(0)
    card.lineStyle(1.5, result.won ? 0x39ff14 : 0xff4444, 0.7)
    card.fillStyle(result.won ? 0x001a00 : 0x1a0000, 0.92)
    card.fillRoundedRect(w / 2 - 110, cardY - 20, 220, 140, 10)
    card.strokeRoundedRect(w / 2 - 110, cardY - 20, 220, 140, 10)
    this.tweens.add({ targets: card, alpha: 1, duration: 320 })

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
      targets: resultText, alpha: 1, scaleX: 1, scaleY: 1,
      duration: 380, ease: 'Back.Out',
    })

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
    bg.fillRect(0, h * 0.72, w, h * 0.28)
    bg.lineStyle(2, 0xff3300, 0.3)
    bg.lineBetween(0, h * 0.72, w, h * 0.72)

    // Grid
    const grid = this.add.graphics()
    grid.lineStyle(1, 0xff3300, 0.05)
    for (let x = 0; x < w; x += 38) grid.lineBetween(x, 0, x, h)
    for (let y = 0; y < h; y += 38) grid.lineBetween(0, y, w, y)

    // City silhouette at ground level
    const city = this.add.graphics()
    city.fillStyle(0x220505, 1)
    const buildings = [
      { x: 10, w: 28, h: 55 }, { x: 44, w: 20, h: 35 }, { x: 70, w: 32, h: 70 },
      { x: 108, w: 18, h: 42 }, { x: 132, w: 26, h: 60 }, { x: 164, w: 16, h: 28 },
      { x: 200, w: 36, h: 80 }, { x: 242, w: 22, h: 48 }, { x: 270, w: 30, h: 55 },
      { x: 306, w: 20, h: 38 }, { x: 332, w: 40, h: 65 }, { x: 378, w: 18, h: 44 },
    ]
    const groundLine = h * 0.72
    buildings.forEach((b) => {
      city.fillRect(b.x, groundLine - b.h, b.w, b.h)
    })
    city.fillStyle(0xff4400, 0.4)
    buildings.forEach((b) => {
      city.fillRect(b.x + 4, groundLine - b.h + 8, 4, 4)
      if (b.w > 24) city.fillRect(b.x + b.w - 10, groundLine - b.h + 16, 4, 4)
    })
  }

  private generateTextures() {
    if (this.textures.exists('raid_drone')) return

    const dg = this.make.graphics({ x: 0, y: 0, add: false })
    paintDrone(dg, false)
    dg.generateTexture('raid_drone', 128, 128)
    dg.destroy()

    // Fortress turret (128×128, gun barrels face LEFT)
    const tg = this.make.graphics({ x: 0, y: 0, add: false })

    tg.fillStyle(0x220505, 1)
    tg.fillRect(6, 96, 116, 26)
    tg.lineStyle(2, 0xff2200, 0.4)
    tg.lineBetween(6, 96, 122, 96)

    tg.fillStyle(0x330808, 1)
    tg.fillRect(8, 98, 34, 20)
    tg.fillRect(46, 98, 34, 20)
    tg.fillRect(84, 98, 34, 20)
    tg.lineStyle(1, 0xff4400, 0.12)
    tg.lineBetween(42, 98, 42, 118)
    tg.lineBetween(80, 98, 80, 118)

    tg.fillStyle(0x3a0808, 1)
    tg.fillRect(20, 42, 88, 58)
    tg.fillStyle(0x5a0e0e, 1)
    tg.fillRect(20, 36, 88, 60)
    tg.fillStyle(0x480c0c, 1)
    tg.fillRect(20, 36, 14, 60)
    tg.fillRect(94, 36, 14, 60)
    tg.lineStyle(1, 0xff5555, 0.14)
    tg.lineBetween(21, 40, 21, 94)
    tg.lineBetween(34, 40, 34, 94)

    tg.fillStyle(0x6e1212, 1)
    tg.fillRoundedRect(16, 20, 96, 22, 4)
    tg.fillStyle(0x881818, 1)
    tg.fillRoundedRect(16, 14, 96, 18, 4)

    tg.fillStyle(0xff3300, 0.55)
    tg.fillRect(20, 15, 16, 8)
    tg.fillRect(54, 15, 16, 8)
    tg.fillRect(88, 15, 16, 8)

    tg.fillStyle(0x3a0808, 1)
    tg.fillRect(22, 10, 12, 8)
    tg.fillRect(58, 10, 12, 8)
    tg.fillRect(94, 10, 12, 8)

    tg.fillStyle(0x1a1a1a, 1)
    tg.fillRoundedRect(0, 42, 36, 12, 3)
    tg.fillStyle(0x333333, 1)
    tg.fillRoundedRect(0, 43, 34, 6, 2)
    tg.fillStyle(0x181818, 1)
    tg.fillRoundedRect(0, 60, 30, 10, 3)
    tg.fillStyle(0x2e2e2e, 1)
    tg.fillRoundedRect(0, 61, 28, 5, 2)

    tg.lineStyle(2, 0xff3300, 0.55)
    tg.strokeCircle(4, 48, 6)
    tg.strokeCircle(4, 65, 5)

    tg.fillStyle(0xff0000, 1)
    tg.fillCircle(28, 20, 5)
    tg.fillStyle(0xff0000, 0.3)
    tg.fillCircle(28, 20, 9)
    tg.fillStyle(0xff8800, 1)
    tg.fillCircle(100, 20, 4)
    tg.fillStyle(0xff8800, 0.25)
    tg.fillCircle(100, 20, 7)

    tg.fillStyle(0x282828, 1)
    tg.fillEllipse(104, 58, 22, 30)
    tg.fillStyle(0x383838, 1)
    tg.fillEllipse(104, 57, 15, 21)
    tg.lineStyle(1, 0xff4444, 0.4)
    tg.lineBetween(104, 48, 104, 66)
    tg.lineBetween(95, 57, 113, 57)

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
