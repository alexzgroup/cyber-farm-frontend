import Phaser from 'phaser'
import type { RaidResult, Drone } from '../../store/gameStore'
import { paintDrone, paintFarmTurret } from '../utils/droneGraphics'
import { soundManager } from '../utils/soundManager'

export interface RaidSceneData {
  result: RaidResult
  attackerDrones: Drone[]                      // actual working player drones
  targetTurrets: Array<{ level: 1 | 2 | 3 }>  // sorted strongest→weakest
  onComplete: () => void
}

// Split an array into chunks of size n
function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

const MAX_PER_ROW = 4

export class RaidScene extends Phaser.Scene {
  private raidData: RaidSceneData | null = null

  constructor() { super({ key: 'RaidScene' }) }

  setRaidData(d: RaidSceneData) { this.raidData = d }

  create() {
    if (!this.raidData) return
    const W = this.scale.width
    const H = this.scale.height
    const { result, attackerDrones, targetTurrets } = this.raidData

    this.generateTextures()
    this.drawSky(W, H)
    this.drawField(W, H)
    this.drawFortress(W, H)

    // Antenna pulse
    const antX = W / 2, antY = H * 0.30 - 122
    const antGlow = this.add.graphics().setDepth(3)
    this.time.addEvent({
      delay: 380, repeat: -1,
      callback: () => {
        antGlow.clear()
        antGlow.fillStyle(0xff0000, 0.18 + Math.random() * 0.22)
        antGlow.fillCircle(antX, antY, 14)
      },
    })

    // Enemy name
    this.add.text(W / 2, H * 0.21, `⚡ ${result.targetName}`, {
      fontSize: '14px', fontFamily: 'monospace', color: '#ff5555',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(6)

    // "АТАКА" label
    this.add.text(W / 2, H * 0.79, '▲ АТАКА', {
      fontSize: '13px', fontFamily: 'monospace', color: '#00e5ff',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(8)

    // Build waves and turret rows
    const droneWaves   = chunk(attackerDrones, MAX_PER_ROW)
    const turretRows   = chunk(targetTurrets,  MAX_PER_ROW)
    const totalWaves   = droneWaves.length
    const totalTurretRows = turretRows.length

    // "ВТОРЖЕНИЕ!" flash at 650ms, then start waves
    this.time.delayedCall(650, () => {
      this.showFlash('ВТОРЖЕНИЕ!', '#ff2200', W, H, () => {
        this.runWave(0, droneWaves, turretRows, totalWaves, totalTurretRows, result, W, H)
      })
    })
  }

  // ─── Wave runner ─────────────────────────────────────────────────────────────
  private runWave(
    waveIdx: number,
    droneWaves: Drone[][],
    turretRows: Array<Array<{ level: 1 | 2 | 3 }>>,
    totalWaves: number,
    totalTurretRows: number,
    result: RaidResult,
    W: number,
    H: number,
  ) {
    const drones  = droneWaves[waveIdx]   ?? []
    const turrets = turretRows[waveIdx]   ?? []   // corresponding turret row (may be empty)
    const isLast  = waveIdx === totalWaves - 1
    const waveLabel = totalWaves > 1 ? `ВОЛНА ${waveIdx + 1}/${totalWaves}` : null

    if (waveLabel) {
      this.showFlash(waveLabel, '#00e5ff', W, H)
    }

    // Create turret sprites for this row
    const turretImages: Phaser.GameObjects.Image[] = []
    const warnGlows: Phaser.GameObjects.Graphics[] = []

    turrets.forEach((turret, i) => {
      const pos = this.pp(i, turrets.length, 0, W, H)
      const wg = this.add.graphics().setDepth(4)
      wg.fillStyle(0xff2200, 0.07)
      wg.fillEllipse(pos.x, pos.y, 54, 28)
      warnGlows.push(wg)

      const img = this.add.image(pos.x, pos.y, `raid_turret_${turret.level}`)
        .setScale(pos.scale).setDepth(5).setAlpha(0)
      turretImages.push(img)
      this.tweens.add({ targets: img, alpha: 1, duration: 200, delay: (turrets.length - 1 - i) * 100 })
    })

    // Warn pulse
    this.time.addEvent({
      delay: 240, repeat: 6,
      callback: () => {
        warnGlows.forEach((wg, i) => {
          wg.clear()
          wg.fillStyle(0xff2200, Math.random() * 0.16 + 0.04)
          wg.fillEllipse(turretImages[i]?.x ?? 0, turretImages[i]?.y ?? 0, 54, 28)
        })
      },
    })

    // Create drone sprites for this wave
    const droneImages: Phaser.GameObjects.Image[] = []

    drones.forEach((drone, i) => {
      const pos = this.pp(i, drones.length, 1, W, H)
      const tex = `raid_drone_${drone.droneType}`
      const img = this.add.image(pos.x, pos.y, tex)
        .setScale(pos.scale).setDepth(7).setAlpha(0)
      droneImages.push(img)
      this.tweens.add({ targets: img, alpha: 1, duration: 220, delay: i * 75 })

      // Idle hover
      this.tweens.add({
        targets: img, y: pos.y - 9,
        duration: 900 + i * 130, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut', delay: i * 100,
      })
    })

    // LAUNCH at 500ms
    this.time.delayedCall(500, () => {
      soundManager.laser()
      this.cameras.main.shake(220, 0.010)
      droneImages.forEach((d) => this.spawnThrust(d.x, d.y, d.scaleX))

      droneImages.forEach((d, i) => {
        this.tweens.killTweensOf(d)
        const atk = this.pp(i, drones.length, 0.1, W, H)
        this.tweens.add({
          targets: d, x: atk.x, y: atk.y,
          scaleX: atk.scale, scaleY: atk.scale,
          duration: 750, ease: 'Power2.In',
        })
      })
      this.spawnSpeedLines(W, H)
    })

    // Turrets fire (1050ms, staggered)
    turrets.forEach((_, i) => {
      this.time.delayedCall(1050 + i * 150, () => {
        const t = turretImages[i], d = droneImages[i] ?? droneImages[0]
        if (!t || !d) return
        soundManager.laser()
        this.fireLaser(t.x, t.y, d.x, d.y, 0xff4400)
        this.time.delayedCall(100, () => this.cameras.main.shake(100, 0.008))
      })
    })

    // Drones fire back (1400ms)
    drones.forEach((_, i) => {
      this.time.delayedCall(1400 + i * 130, () => {
        const d = droneImages[i], t = turretImages[i] ?? turretImages[0]
        if (!d) return
        this.fireLaser(d.x, d.y, t?.x ?? W * 0.75, t?.y ?? H * 0.38, 0x00e5ff)
        if (t) {
          this.time.delayedCall(180, () => {
            this.spawnExplosion(t.x, t.y, 0x00ccff, 0.5)
            this.cameras.main.shake(120, 0.009)
          })
        }
      })
    })

    // Second turret salvo (1700ms)
    turrets.forEach((_, i) => {
      this.time.delayedCall(1700 + (turrets.length - 1 - i) * 120, () => {
        const t = turretImages[i], d = droneImages[i] ?? droneImages[0]
        if (!t || !d) return
        soundManager.laser()
        this.fireLaser(t.x, t.y, d.x, d.y, 0xff2200)
      })
    })

    // RESOLUTION at 2100ms
    this.time.delayedCall(2100, () => {
      const waveWon = result.won || !isLast  // all non-last waves "win" on success

      if (waveWon && result.won) {
        // Destroy this turret row
        turretImages.forEach((t, i) => {
          this.time.delayedCall(i * 210, () => {
            this.spawnExplosion(t.x, t.y, 0xff7700, 0.9)
            this.cameras.main.shake(240, 0.015)
            t.setVisible(false)
            warnGlows[i]?.setVisible(false)
          })
        })

        // Drones fly back
        this.time.delayedCall(turrets.length * 210 + 100, () => {
          droneImages.forEach((d, i) => {
            const home = this.pp(i, drones.length, 1.0, W, H)
            this.tweens.add({
              targets: d, x: home.x, y: home.y,
              scaleX: home.scale, scaleY: home.scale,
              duration: 600, ease: 'Power2.Out',
            })
          })

          const cleanupDelay = turrets.length * 210 + 800
          this.time.delayedCall(cleanupDelay, () => {
            // Cleanup this wave's sprites
            droneImages.forEach((d) => d.destroy())
            turretImages.forEach((t) => t.destroy())
            warnGlows.forEach((g) => g.destroy())

            if (!isLast) {
              this.time.delayedCall(200, () => {
                const nextRow = turretRows[waveIdx + 1]
                const hasMoreTurrets = nextRow && nextRow.length > 0
                if (hasMoreTurrets) {
                  this.runWave(waveIdx + 1, droneWaves, turretRows, totalWaves, totalTurretRows, result, W, H)
                } else {
                  // Base fully destroyed — no more turrets, end immediately
                  this.spawnMegaExplosion(W / 2, H * 0.26, W, H)
                  this.cameras.main.shake(900, 0.032)
                  this.time.delayedCall(1500, () => this.showResult(result, W, H))
                }
              })
            } else {
              // All waves done → MEGA explosion + result
              this.time.delayedCall(100, () => {
                this.spawnMegaExplosion(W / 2, H * 0.26, W, H)
                this.cameras.main.shake(900, 0.032)
              })
              this.time.delayedCall(1500, () => this.showResult(result, W, H))
            }
          })
        })

      } else {
        // Drones shot down
        droneImages.forEach((d, i) => {
          this.time.delayedCall(i * 200, () => {
            this.spawnExplosion(d.x, d.y, 0x00e5ff, 0.9)
            this.cameras.main.shake(260, 0.018)
            this.tweens.add({
              targets: d, alpha: 0, angle: 160,
              y: d.y + 90,
              scaleX: d.scaleX * 0.22, scaleY: d.scaleY * 0.22,
              duration: 520, ease: 'Power2.In',
            })
          })
        })

        const delay = drones.length * 200 + 1000
        this.time.delayedCall(delay, () => {
          droneImages.forEach((d) => { if (d.scene) d.destroy() })
          turretImages.forEach((t) => { if (t.scene) t.destroy() })
          warnGlows.forEach((g) => g.destroy())
          this.showResult(result, W, H)
        })
      }
    })
  }

  // ─── Perspective helper: depth 0=far/enemy, 1=near/player ───────────────────
  private pp(col: number, totalCols: number, depth: number, W: number, H: number) {
    const cols = Math.max(totalCols, 1)
    const farY  = H * 0.37, nearY = H * 0.68
    const y = Phaser.Math.Linear(farY, nearY, depth)
    const farHS = W * 0.145, nearHS = W * 0.400
    const hs = Phaser.Math.Linear(farHS, nearHS, depth)
    const step = cols > 1 ? (hs * 2) / (cols - 1) : 0
    const x = W / 2 - hs + col * step
    const scale = Phaser.Math.Linear(0.33, 0.72, depth)
    return { x, y, scale }
  }

  // ─── Flash text ──────────────────────────────────────────────────────────────
  private showFlash(text: string, color: string, W: number, H: number, onDone?: () => void) {
    const t = this.add.text(W / 2, H * 0.50, text, {
      fontSize: '28px', fontFamily: 'monospace', fontStyle: 'bold',
      color, stroke: '#000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(18).setAlpha(0).setScale(0.5)

    this.tweens.add({
      targets: t, alpha: 1, scaleX: 1, scaleY: 1,
      duration: 160, ease: 'Back.Out',
      onComplete: () => {
        this.time.delayedCall(280, () => {
          this.tweens.add({
            targets: t, alpha: 0, duration: 180,
            onComplete: () => { t.destroy(); onDone?.() },
          })
        })
      },
    })
  }

  // ─── FX ──────────────────────────────────────────────────────────────────────
  private spawnThrust(x: number, y: number, dscale: number) {
    const s = dscale * 1.1
    const g = this.add.graphics().setDepth(6)
    g.fillStyle(0xff9900, 0.92)
    g.fillTriangle(x - 12 * s, y + 10 * s, x + 12 * s, y + 10 * s, x, y + 36 * s)
    g.fillStyle(0xffdd00, 0.75)
    g.fillTriangle(x - 7 * s, y + 10 * s, x + 7 * s, y + 10 * s, x, y + 24 * s)
    g.fillStyle(0xffffff, 0.50)
    g.fillTriangle(x - 3 * s, y + 10 * s, x + 3 * s, y + 10 * s, x, y + 16 * s)
    this.tweens.add({
      targets: g, alpha: 0, duration: 480, ease: 'Power2.Out',
      onComplete: () => g.destroy(),
    })
  }

  private spawnSpeedLines(W: number, H: number) {
    for (let i = 0; i < 8; i++) {
      const sl = this.add.graphics().setDepth(6).setAlpha(0.5)
      const sy = H * 0.55 + (Math.random() - 0.5) * H * 0.3
      const sx = Math.random() * W
      sl.lineStyle(1.5, 0x00e5ff, 0.6)
      sl.lineBetween(sx, sy, sx + 60 + Math.random() * 80, sy)
      this.tweens.add({
        targets: sl, x: -W, alpha: 0,
        duration: 280 + Math.random() * 160, delay: i * 40,
        ease: 'Power2.In', onComplete: () => sl.destroy(),
      })
    }
  }

  private fireLaser(fromX: number, fromY: number, toX: number, toY: number, color: number) {
    const bolt = this.add.graphics().setDepth(9)
    const dx = toX - fromX, dy = toY - fromY
    const total = Math.sqrt(dx * dx + dy * dy)
    const nx = dx / total, ny = dy / total
    const TAIL = 50, state = { dist: 0 }
    const redraw = () => {
      bolt.clear()
      const hx = fromX + nx * state.dist, hy = fromY + ny * state.dist
      const td = Math.max(0, state.dist - TAIL)
      bolt.lineStyle(8, color, 0.16); bolt.lineBetween(fromX + nx * td, fromY + ny * td, hx, hy)
      bolt.lineStyle(3, color, 1);    bolt.lineBetween(fromX + nx * td, fromY + ny * td, hx, hy)
      bolt.fillStyle(color, 0.55);    bolt.fillCircle(hx, hy, 6)
      bolt.fillStyle(0xffffff, 0.9);  bolt.fillCircle(hx, hy, 3)
    }
    redraw()
    this.tweens.add({
      targets: state, dist: total, duration: 480, ease: 'Linear',
      onUpdate: redraw, onComplete: () => bolt.destroy(),
    })
  }

  private spawnExplosion(x: number, y: number, color: number, intensity: number) {
    soundManager.explosion()
    const rings = Math.max(2, Math.floor(4 * intensity))
    for (let i = 0; i < rings; i++) {
      const ring = this.add.graphics().setDepth(10)
      ring.lineStyle(2.5 - i * 0.4, color, 1); ring.strokeCircle(0, 0, 8)
      ring.x = x; ring.y = y
      this.tweens.add({
        targets: ring,
        scaleX: (4.5 + i * 2.2) * intensity, scaleY: (4.5 + i * 2.2) * intensity,
        alpha: 0, duration: 520 + i * 85, delay: i * 60, ease: 'Cubic.Out',
        onComplete: () => ring.destroy(),
      })
    }
    for (let i = 0; i < Math.floor(16 * intensity); i++) {
      const angle = (i / (16 * intensity)) * Math.PI * 2 + Math.random() * 0.35
      const dist  = (26 + Math.random() * 42) * intensity
      const spark = this.add.graphics().setDepth(10)
      spark.fillStyle(i % 4 === 0 ? 0xffffff : color, 1)
      spark.fillCircle(0, 0, 1.5 + Math.random() * 2.2)
      spark.x = x; spark.y = y
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist,
        alpha: 0, scaleX: 0.15, scaleY: 0.15,
        duration: 380 + Math.random() * 300, ease: 'Cubic.Out',
        onComplete: () => spark.destroy(),
      })
    }
    const fl = this.add.graphics().setDepth(11)
    fl.fillStyle(0xffffff, 0.55); fl.fillCircle(x, y, 19 * intensity)
    this.tweens.add({
      targets: fl, alpha: 0, scaleX: 2.6, scaleY: 2.6, duration: 175,
      onComplete: () => fl.destroy(),
    })
  }

  private spawnMegaExplosion(cx: number, cy: number, W: number, H: number) {
    const sf = this.add.graphics().setDepth(20)
    sf.fillStyle(0xff4400, 0.40); sf.fillRect(0, 0, W, H)
    this.tweens.add({ targets: sf, alpha: 0, duration: 430, onComplete: () => sf.destroy() })
    for (let i = 0; i < 8; i++) {
      this.time.delayedCall(i * 100, () => {
        const ox = cx + (Math.random() - 0.5) * 90
        const oy = cy + (Math.random() - 0.5) * 55
        this.spawnExplosion(ox, oy, i % 2 === 0 ? 0xff7700 : 0xff2200, 1.7)
      })
    }
    for (let i = 0; i < 26; i++) {
      const angle = Math.random() * Math.PI * 2, dist = 55 + Math.random() * 130
      const deb = this.add.graphics().setDepth(12)
      deb.fillStyle(i % 3 === 0 ? 0x663300 : 0x440000, 1); deb.fillRect(-4, -3, 8, 5)
      deb.x = cx; deb.y = cy
      this.tweens.add({
        targets: deb,
        x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
        angle: Math.random() * 720 - 360, alpha: 0,
        duration: 700 + Math.random() * 500, ease: 'Power2.Out',
        onComplete: () => deb.destroy(),
      })
    }
  }

  // ─── Result card ─────────────────────────────────────────────────────────────
  private showResult(result: RaidResult, W: number, H: number) {
    const overlay = this.add.graphics().setDepth(15)
    overlay.fillStyle(0x000000, 0); overlay.fillRect(0, 0, W, H)
    this.tweens.add({ targets: overlay, alpha: 0.60, duration: 400 })

    const cardY = H * 0.36
    const card  = this.add.graphics().setDepth(16).setAlpha(0)
    card.lineStyle(1.5, result.won ? 0x39ff14 : 0xff4444, 0.75)
    card.fillStyle(result.won ? 0x001800 : 0x1a0000, 0.94)
    card.fillRoundedRect(W / 2 - 118, cardY - 20, 236, 154, 10)
    card.strokeRoundedRect(W / 2 - 118, cardY - 20, 236, 154, 10)
    this.tweens.add({ targets: card, alpha: 1, duration: 320 })

    const title = this.add.text(W / 2, cardY + 20,
      result.won ? '✓  ПОБЕДА' : '✗  ПОРАЖЕНИЕ',
      { fontSize: '28px', fontFamily: 'monospace', fontStyle: 'bold',
        color: result.won ? '#39ff14' : '#ff4444', stroke: '#000', strokeThickness: 4 }
    ).setOrigin(0.5).setAlpha(0).setScale(0.4).setDepth(17)
    this.tweens.add({ targets: title, alpha: 1, scaleX: 1, scaleY: 1, duration: 380, ease: 'Back.Out' })

    const sub = this.add.text(W / 2, cardY + 64,
      result.won ? `+${result.amount} монет украдено` : 'Дрон повреждён',
      { fontSize: '15px', fontFamily: 'monospace', color: result.won ? '#88ff88' : '#ff9999' }
    ).setOrigin(0.5).setAlpha(0).setDepth(17)

    const sub2 = this.add.text(W / 2, cardY + 84,
      result.won ? `у базы ${result.targetName}` : `${result.targetName} отбил атаку`,
      { fontSize: '11px', fontFamily: 'monospace', color: result.won ? '#66cc66' : '#cc6666' }
    ).setOrigin(0.5).setAlpha(0).setDepth(17)

    this.time.delayedCall(280, () => {
      this.tweens.add({ targets: sub,  alpha: 1, duration: 280 })
      this.tweens.add({ targets: sub2, alpha: 1, duration: 280, delay: 80 })
      this.time.delayedCall(500, () => {
        const btn = this.add.text(W / 2, cardY + 114, 'Продолжить  →', {
          fontSize: '14px', fontFamily: 'monospace', color: '#00e5ff',
          backgroundColor: '#00e5ff18', padding: { x: 18, y: 8 },
        }).setOrigin(0.5).setAlpha(0).setInteractive({ useHandCursor: true }).setDepth(17)
        this.tweens.add({ targets: btn, alpha: 1, duration: 250 })
        btn.on('pointerdown', () => this.raidData?.onComplete())
        btn.on('pointerover', () => btn.setStyle({ color: '#fff', backgroundColor: '#00e5ff33' }))
        btn.on('pointerout',  () => btn.setStyle({ color: '#00e5ff', backgroundColor: '#00e5ff18' }))
      })
    })
  }

  // ─── Background layers ────────────────────────────────────────────────────────
  private drawSky(W: number, H: number) {
    const bg = this.add.graphics().setDepth(0)
    bg.fillGradientStyle(0x000510, 0x000510, 0x08010e, 0x08010e, 1)
    bg.fillRect(0, 0, W, H * 0.32)
    for (let i = 0; i < 100; i++) {
      bg.fillStyle(0xffffff, 0.35 + Math.random() * 0.65)
      bg.fillCircle(Math.random() * W, Math.random() * H * 0.30, Math.random() * 1.3 + 0.2)
    }
    bg.fillStyle(0xff1100, 0.028); bg.fillEllipse(W * 0.70, H * 0.09, W * 0.55, H * 0.20)
    bg.fillStyle(0x3300aa, 0.030); bg.fillEllipse(W * 0.28, H * 0.16, W * 0.45, H * 0.18)
    bg.fillGradientStyle(0x1a0505, 0x1a0505, 0x060210, 0x060210, 1)
    bg.fillRect(0, H * 0.28, W, H * 0.50)
    bg.fillStyle(0x0e0202, 1); bg.fillRect(0, H * 0.75, W, H * 0.25)
  }

  private drawField(W: number, H: number) {
    const horizY = H * 0.32, nearY = H * 0.75
    const field = this.add.graphics().setDepth(1)
    field.fillStyle(0x120303, 1)
    field.fillPoints([
      new Phaser.Math.Vector2(0, nearY), new Phaser.Math.Vector2(W, nearY),
      new Phaser.Math.Vector2(W * 0.74, horizY), new Phaser.Math.Vector2(W * 0.26, horizY),
    ])
    for (let i = 0; i <= 14; i++) {
      const t = i / 14, tp = Math.sqrt(t)
      const y = Phaser.Math.Linear(horizY, nearY, tp)
      const xL = Phaser.Math.Linear(W * 0.26, 0, tp), xR = Phaser.Math.Linear(W * 0.74, W, tp)
      field.lineStyle(1, tp < 0.55 ? 0xff3300 : 0x003322, 0.025 + tp * 0.095)
      field.lineBetween(xL, y, xR, y)
    }
    for (let i = 0; i <= 11; i++) {
      const t = i / 11
      field.lineStyle(1, 0x333333, 0.07)
      field.lineBetween(t * W, nearY, W * 0.26 + t * W * 0.48, horizY)
    }
    const gh = this.add.graphics().setDepth(1)
    gh.fillStyle(0xff1100, 0.09); gh.fillRect(0, horizY - 10, W, 20)
    gh.lineStyle(1.5, 0xff4400, 0.38); gh.lineBetween(0, horizY, W, horizY)
    this.add.text(10, horizY + 5,  'ENEMY ZONE', { fontSize: '9px', fontFamily: 'monospace', color: '#ff3300' }).setAlpha(0.35).setDepth(2)
    this.add.text(10, nearY - 18,  'YOUR ZONE',  { fontSize: '9px', fontFamily: 'monospace', color: '#00e5ff' }).setAlpha(0.35).setDepth(2)
  }

  private drawFortress(W: number, H: number) {
    const horizY = H * 0.32, cx = W / 2
    const fort = this.add.graphics().setDepth(2)

    fort.fillStyle(0xff0000, 0.05); fort.fillEllipse(cx, horizY - 55, W * 0.68, H * 0.28)
    fort.fillStyle(0x140202, 1); fort.fillRect(cx - 200, horizY - 35, 48, 40); fort.fillRect(cx + 152, horizY - 35, 48, 40)
    fort.fillStyle(0x1e0404, 1); fort.fillRect(cx - 152, horizY - 60, 62, 65); fort.fillRect(cx + 90, horizY - 60, 62, 65)
    fort.fillStyle(0x2c0505, 1); fort.fillRect(cx - 72, horizY - 104, 144, 109)
    fort.fillStyle(0x460a0a, 1); fort.fillRect(cx - 66, horizY - 100, 132, 105)
    fort.lineStyle(1, 0x600e0e, 0.45)
    for (let py = -88; py < 5; py += 18) fort.lineBetween(cx - 62, horizY + py, cx + 62, horizY + py)
    fort.fillStyle(0x761414, 1)
    for (let bx = -58; bx <= 58; bx += 16) fort.fillRect(cx + bx - 5, horizY - 108, 11, 13)
    fort.fillStyle(0x4e0c0c, 1)
    for (let bx = -148; bx <= -94; bx += 14) fort.fillRect(cx + bx - 4, horizY - 67, 10, 10)
    for (let bx = 94;   bx <= 148;  bx += 14) fort.fillRect(cx + bx - 4, horizY - 67, 10, 10)
    fort.fillStyle(0xff2200, 0.80)
    fort.fillRect(cx - 34, horizY - 82, 13, 17); fort.fillRect(cx + 21, horizY - 82, 13, 17)
    fort.fillRect(cx - 16, horizY - 57, 11, 14); fort.fillRect(cx + 5,  horizY - 57, 11, 14)
    fort.fillStyle(0xff2200, 0.13)
    fort.fillRect(cx - 38, horizY - 87, 21, 27); fort.fillRect(cx + 17, horizY - 87, 21, 27)
    fort.fillStyle(0xff1100, 0.55)
    fort.fillRect(cx - 132, horizY - 48, 9, 13); fort.fillRect(cx + 123, horizY - 48, 9, 13)
    fort.fillRect(cx - 182, horizY - 26, 8, 11); fort.fillRect(cx + 174, horizY - 26, 8, 11)
    fort.lineStyle(2, 0xff0000, 0.75); fort.lineBetween(cx, horizY - 100, cx, horizY - 126)
    fort.lineStyle(1, 0xff0000, 0.28); fort.strokeCircle(cx, horizY - 124, 9)
    fort.fillStyle(0xff0000, 0.96); fort.fillCircle(cx, horizY - 126, 5.5)
    fort.fillStyle(0xff0000, 0.20); fort.fillCircle(cx, horizY - 126, 13)
    fort.lineStyle(1.5, 0xff2200, 0.50)
    fort.lineBetween(cx - 115, horizY - 60, cx - 115, horizY - 76)
    fort.lineBetween(cx + 115, horizY - 60, cx + 115, horizY - 76)
    fort.fillStyle(0xff2200, 0.85); fort.fillCircle(cx - 115, horizY - 77, 3.5); fort.fillCircle(cx + 115, horizY - 77, 3.5)
    fort.lineStyle(2, 0xff4400, 0.42); fort.lineBetween(cx - 200, horizY, cx + 200, horizY)
  }

  // ─── Texture generation ──────────────────────────────────────────────────────
  private generateTextures() {
    // Drone textures: 3 types × 2 states
    const types: Array<1 | 2 | 3> = [1, 2, 3]
    for (const t of types) {
      const key = `raid_drone_${t}`
      if (!this.textures.exists(key)) {
        const g = this.make.graphics({ x: 0, y: 0, add: false })
        paintDrone(g, false, t)
        g.generateTexture(key, 128, 128)
        g.destroy()
      }
    }

    // Turret textures: 3 levels
    const levels: Array<1 | 2 | 3> = [1, 2, 3]
    for (const lv of levels) {
      const key = `raid_turret_${lv}`
      if (!this.textures.exists(key)) {
        const g = this.make.graphics({ x: 0, y: 0, add: false })
        this.buildTurretTexture(g, lv)
        g.generateTexture(key, 128, 128)
        g.destroy()
      }
    }
  }

  private buildTurretTexture(tg: Phaser.GameObjects.Graphics, level: 1 | 2 | 3) {
    // Base platform
    tg.fillStyle(0x220505, 1); tg.fillRect(6, 96, 116, 26)
    tg.lineStyle(2, 0xff2200, 0.4); tg.lineBetween(6, 96, 122, 96)
    tg.fillStyle(0x330808, 1); tg.fillRect(8, 98, 34, 20); tg.fillRect(46, 98, 34, 20); tg.fillRect(84, 98, 34, 20)
    // Tower
    tg.fillStyle(0x3a0808, 1); tg.fillRect(20, 42, 88, 58)
    tg.fillStyle(0x5a0e0e, 1); tg.fillRect(20, 36, 88, 60)
    tg.fillStyle(0x480c0c, 1); tg.fillRect(20, 36, 14, 60); tg.fillRect(94, 36, 14, 60)
    // Cap
    tg.fillStyle(0x6e1212, 1); tg.fillRoundedRect(16, 20, 96, 22, 4)
    tg.fillStyle(0x881818, 1); tg.fillRoundedRect(16, 14, 96, 18, 4)
    // Level-based warning stripe color
    const stripeColor = level === 1 ? 0x00cc44 : level === 2 ? 0xffaa00 : 0xff3300
    tg.fillStyle(stripeColor, 0.65); tg.fillRect(20, 15, 16, 8); tg.fillRect(54, 15, 16, 8); tg.fillRect(88, 15, 16, 8)
    // Battlements
    tg.fillStyle(0x3a0808, 1); tg.fillRect(22, 10, 12, 8); tg.fillRect(58, 10, 12, 8); tg.fillRect(94, 10, 12, 8)
    // Gun barrels
    tg.fillStyle(0x1a1a1a, 1); tg.fillRoundedRect(0, 42, 36, 12, 3)
    tg.fillStyle(0x333333, 1); tg.fillRoundedRect(0, 43, 34, 6, 2)
    if (level >= 2) {
      tg.fillStyle(0x181818, 1); tg.fillRoundedRect(0, 60, 30, 10, 3)
      tg.fillStyle(0x2e2e2e, 1); tg.fillRoundedRect(0, 61, 28, 5, 2)
    }
    if (level >= 3) {
      tg.fillStyle(0x151515, 1); tg.fillRoundedRect(0, 74, 26, 8, 2)
      tg.fillStyle(0x2a2a2a, 1); tg.fillRoundedRect(0, 75, 24, 4, 2)
    }
    // Muzzle rings
    tg.lineStyle(2, stripeColor, 0.55); tg.strokeCircle(4, 48, 6)
    if (level >= 2) tg.strokeCircle(4, 65, 5)
    if (level >= 3) tg.strokeCircle(4, 78, 4)
    // Warning light
    tg.fillStyle(stripeColor, 1); tg.fillCircle(28, 20, 5)
    tg.fillStyle(stripeColor, 0.3); tg.fillCircle(28, 20, 9)
    // Radar
    tg.fillStyle(0x282828, 1); tg.fillEllipse(104, 58, 22, 30)
    tg.fillStyle(0x383838, 1); tg.fillEllipse(104, 57, 15, 21)
    tg.lineStyle(1, stripeColor, 0.4); tg.lineBetween(104, 48, 104, 66); tg.lineBetween(95, 57, 113, 57)
    // Energy core
    tg.fillStyle(0x880000, 0.9); tg.fillCircle(64, 62, 10)
    tg.fillStyle(stripeColor, 0.5); tg.fillCircle(64, 62, 6)
    tg.fillStyle(0xff8800, 0.8); tg.fillCircle(64, 62, 3)
    tg.lineStyle(1, stripeColor, 0.5); tg.strokeCircle(64, 62, 14)
  }
}
