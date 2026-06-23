import Phaser from 'phaser'
import { paintDrone } from '../utils/droneGraphics'
import { soundManager } from '../utils/soundManager'

export interface DuelSceneConfig {
  playerDroneType:  1 | 2 | 3
  playerUpgrades:   Record<string, number>
  opponentName:     string
  opponentType:     1 | 2 | 3
  opponentUpgrades: Record<string, number>
  onEnd: (won: boolean) => void
}

interface DroneStats {
  hp:       number
  maxHp:    number
  damage:   number
  fireRate: number
  speed:    number
  dodge:    number
}

interface Bullet {
  gfx: Phaser.GameObjects.Graphics
  trail: Phaser.GameObjects.Graphics
  vx:  number
  vy:  number
  fromPlayer: boolean
  color: number
}

function calcStats(upgrades: Record<string, number>): DroneStats {
  const armor   = upgrades['armor']   ?? 0
  const cargo   = upgrades['cargo']   ?? 0
  const energy  = upgrades['energy']  ?? 0
  const nav     = upgrades['ai']      ?? 0
  const stealth = upgrades['stealth'] ?? 0
  return {
    hp:       200 + armor   * 8,    // base 200, max 280 at lv10
    maxHp:    200 + armor   * 8,
    damage:   8   + cargo   * 1,    // base 8,   max 18  at lv10
    fireRate: 0.8 + energy  * 0.1,  // base 0.8, max 1.8 at lv10
    speed:    150 + nav     * 12,   // base 150, max 270 at lv10
    dodge:    stealth * 0.03,       // max 0.30 at lv10
  }
}

/** Glow color shifts green→yellow→red as HP drops */
function hpColor(hp: number, maxHp: number): number {
  const pct = Math.max(0, hp / maxHp)
  if (pct > 0.6) return 0x00e5ff   // cyan (healthy)
  if (pct > 0.3) return 0xf59e0b   // amber (wounded)
  return 0xff2222                  // red   (critical)
}

export class DuelScene extends Phaser.Scene {
  private cfg!: DuelSceneConfig

  // Player
  private playerSprite!: Phaser.GameObjects.Image
  private playerGfx!:   Phaser.GameObjects.Graphics   // upgrade overlays
  private playerStats!: DroneStats
  private playerLastShot = 0
  private mouseX = 0
  private mouseY = 0

  // Opponent (WS-driven position)
  private opponentSprite!: Phaser.GameObjects.Image
  private opponentGfx!:   Phaser.GameObjects.Graphics
  private opponentStats!: DroneStats
  private opponentTargetX = 0
  private opponentTargetY = 0

  // Bullets
  private bullets: Bullet[] = []

  // HP sync throttle
  private lastHpSync = 0

  // WS listeners
  private docMouseMove!: (e: MouseEvent) => void
  private onOpponentMove!:  (e: Event) => void
  private onOpponentShoot!: (e: Event) => void
  private onOpponentHpSync!: (e: Event) => void
  private onForceEnd!: (e: Event) => void

  private ended = false
  private W = 0
  private H = 0

  constructor() { super({ key: 'DuelScene' }) }

  setConfig(cfg: DuelSceneConfig) { this.cfg = cfg }

  create() {
    // Use actual canvas size (filled by RESIZE mode).
    // WS coordinates are normalised 0–1 so they map correctly on any screen.
    const { width: W, height: H } = this.scale
    this.W = W; this.H = H

    this.generateTextures()
    this.drawArena(W, H)
    this.spawnDrones(W, H)
    this.setupInput(W, H)

    this.playerStats   = calcStats(this.cfg.playerUpgrades)
    this.opponentStats = calcStats(this.cfg.opponentUpgrades)

    this.mouseX = W * 0.25
    this.mouseY = H * 0.75
    this.opponentTargetX = W * 0.75
    this.opponentTargetY = H * 0.25

    this.emitHp()
    this.sys.canvas.setAttribute('data-duel', '1')
  }

  // ─── Arena ─────────────────────────────────────────────────────────────────

  private drawArena(W: number, H: number) {
    const bg = this.add.graphics().setDepth(0)
    bg.fillStyle(0x050a12, 1); bg.fillRect(0, 0, W, H)

    // Stars
    for (let i = 0; i < 200; i++) {
      const a = Math.random() * 0.8 + 0.1
      bg.fillStyle(0xffffff, a)
      bg.fillCircle(Math.random() * W, Math.random() * H, Math.random() * 1.4 + 0.2)
    }
    // Distant nebula glows
    bg.fillStyle(0x0ea5e9, 0.04); bg.fillEllipse(W * 0.2, H * 0.3, 260, 120)
    bg.fillStyle(0x8b5cf6, 0.05); bg.fillEllipse(W * 0.8, H * 0.7, 200, 100)

    const grid = this.add.graphics().setDepth(1)
    grid.lineStyle(1, 0x00e5ff, 0.05)
    for (let x = 0; x < W; x += 44) grid.lineBetween(x, 0, x, H)
    for (let y = 0; y < H; y += 44) grid.lineBetween(0, y, W, y)

    // Center divider — glowing split line
    const div = this.add.graphics().setDepth(2)
    div.fillStyle(0x00e5ff, 0.06); div.fillRect(W / 2 - 1, 0, 2, H)
    div.lineStyle(1, 0x00e5ff, 0.35); div.lineBetween(W / 2, 0, W / 2, H)

    // Zone labels
    this.add.text(W * 0.25, 20, 'ВАШ ДРОН', {
      fontSize: '9px', fontFamily: 'monospace', color: '#00e5ff',
    }).setOrigin(0.5).setAlpha(0.4).setDepth(3)
    this.add.text(W * 0.75, 20, this.cfg.opponentName.slice(0, 12).toUpperCase(), {
      fontSize: '9px', fontFamily: 'monospace', color: '#ff4444',
    }).setOrigin(0.5).setAlpha(0.4).setDepth(3)

    this.drawObstacles(W, H)
  }

  private drawObstacles(W: number, H: number) {
    const obs = this.add.graphics().setDepth(2)
    const rects: Array<[number, number, number, number]> = [
      [W * 0.10, H * 0.30, 58, 14],
      [W * 0.10, H * 0.68, 58, 14],
      [W * 0.32, H * 0.50 - 38, 14, 76],
      [W * 0.90 - 58, H * 0.30, 58, 14],
      [W * 0.90 - 58, H * 0.68, 58, 14],
      [W * 0.68 - 7,  H * 0.50 - 38, 14, 76],
    ]
    for (const [x, y, w, h] of rects) {
      obs.fillStyle(0x0f2d4a, 1); obs.fillRect(x, y, w, h)
      obs.lineStyle(1.5, 0x00e5ff, 0.30); obs.strokeRect(x, y, w, h)
      // Inner glow
      obs.fillStyle(0x00e5ff, 0.03); obs.fillRect(x + 1, y + 1, w - 2, h - 2)
    }
  }

  // ─── Drones ─────────────────────────────────────────────────────────────────

  private spawnDrones(W: number, H: number) {
    const pKey = `duel_drone_${this.cfg.playerDroneType}`
    const oKey = `duel_drone_${this.cfg.opponentType}`

    this.playerSprite = this.add.image(W * 0.25, H * 0.75, pKey)
      .setScale(0.72).setDepth(10)
    this.opponentSprite = this.add.image(W * 0.75, H * 0.25, oKey)
      .setScale(0.72).setDepth(10).setFlipX(true)

    this.playerGfx   = this.add.graphics().setDepth(9)
    this.opponentGfx = this.add.graphics().setDepth(9)

    // Idle hover animations
    this.tweens.add({
      targets: this.playerSprite, y: this.playerSprite.y - 10,
      duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
    this.tweens.add({
      targets: this.opponentSprite, y: this.opponentSprite.y - 10,
      duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 300,
    })
  }

  /** Draw upgrade visual effects + HP-based glow around a sprite */
  private drawDroneEffects(
    g: Phaser.GameObjects.Graphics,
    sprite: Phaser.GameObjects.Image,
    upgrades: Record<string, number>,
    hp: number,
    maxHp: number,
    isPlayer: boolean,
  ) {
    g.clear()
    const cx = sprite.x, cy = sprite.y
    const glowColor = hpColor(hp, maxHp)
    const pct = Math.max(0, hp / maxHp)

    // ── Base glow (HP-coloured) ───────────────────────────────────────────────
    g.fillStyle(glowColor, 0.09); g.fillCircle(cx, cy, 38)
    g.lineStyle(2, glowColor, 0.55 * pct); g.strokeCircle(cx, cy, 36)

    // ── Armor: thick gold shield hexagon ─────────────────────────────────────
    const armor = upgrades['armor'] ?? 0
    if (armor > 0) {
      const r = 44 + armor * 3
      const pts = 6
      for (let i = 0; i <= pts; i++) {
        const a1 = (i / pts) * Math.PI * 2
        const a2 = ((i + 1) / pts) * Math.PI * 2
        g.lineStyle(1.5 + armor * 0.5, 0xfbbf24, 0.6)
        g.lineBetween(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r,
                      cx + Math.cos(a2) * r, cy + Math.sin(a2) * r)
      }
    }

    // ── Energy Cell: blue pulsing rings ──────────────────────────────────────
    const energy = upgrades['energy'] ?? 0
    if (energy > 0) {
      const t = this.time.now / 500
      for (let i = 0; i < energy; i++) {
        const phase = (t + i * 0.4) % 1
        g.lineStyle(1, 0x38bdf8, (1 - phase) * 0.6)
        g.strokeCircle(cx, cy, 30 + phase * 20)
      }
    }

    // ── AI Navigation: speed trail (teal arcs) ───────────────────────────────
    const ai = upgrades['ai'] ?? 0
    if (ai > 0) {
      const vx = isPlayer ? this.mouseX - cx : this.opponentTargetX - cx
      const vy = isPlayer ? this.mouseY - cy : this.opponentTargetY - cy
      const len = Math.sqrt(vx * vx + vy * vy) || 1
      const nx = vx / len, ny = vy / len
      for (let i = 1; i <= ai; i++) {
        const ox = cx - nx * i * 14, oy = cy - ny * i * 14
        g.fillStyle(0x2dd4bf, 0.5 / i)
        g.fillCircle(ox, oy, 5 - i)
      }
    }

    // ── Stealth: ghost shimmer (dashed faint ring) ────────────────────────────
    const stealth = upgrades['stealth'] ?? 0
    if (stealth > 0) {
      const segs = 12
      for (let i = 0; i < segs; i++) {
        if (i % 2 === 0) continue
        const a1 = (i / segs) * Math.PI * 2
        const a2 = ((i + 1) / segs) * Math.PI * 2
        g.lineStyle(1.5, 0xa78bfa, 0.4 * stealth)
        g.lineBetween(cx + Math.cos(a1) * 42, cy + Math.sin(a1) * 42,
                      cx + Math.cos(a2) * 42, cy + Math.sin(a2) * 42)
      }
    }

    // ── Cargo: orange power ring ──────────────────────────────────────────────
    const cargo = upgrades['cargo'] ?? 0
    if (cargo > 0) {
      g.lineStyle(cargo, 0xf97316, 0.35)
      g.strokeCircle(cx, cy, 28)
    }

    // ── Critical HP warning flash ──────────────────────────────────────────────
    if (pct < 0.3) {
      const flash = Math.sin(this.time.now / 120) * 0.5 + 0.5
      g.fillStyle(0xff2222, flash * 0.15)
      g.fillCircle(cx, cy, 42)
    }
  }

  // ─── Input ──────────────────────────────────────────────────────────────────

  private setupInput(W: number, H: number) {
    const canvas = this.sys.canvas

    // Desktop: follow mouse cursor
    this.docMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      this.mouseX = Phaser.Math.Clamp(e.clientX - rect.left, 4, W - 4)
      this.mouseY = Phaser.Math.Clamp(e.clientY - rect.top,  4, H - 4)
    }
    document.addEventListener('mousemove', this.docMouseMove)

    // Mobile: follow touch drag
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) {
        this.mouseX = Phaser.Math.Clamp(p.x, 4, W - 4)
        this.mouseY = Phaser.Math.Clamp(p.y, 4, H - 4)
      }
    })

    // Shoot on tap (pointerup with minimal movement = tap, not drag)
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) return
      const dx = p.x - p.downX
      const dy = p.y - p.downY
      if (Math.sqrt(dx * dx + dy * dy) < 15) {
        this.playerShoot()
      }
    })

    // Opponent position from WS — denormalise from 0–1 to local pixels
    this.onOpponentMove = (e: Event) => {
      const { nx, ny } = (e as CustomEvent<{ nx: number; ny: number }>).detail
      this.opponentTargetX = nx * this.W
      this.opponentTargetY = ny * this.H
    }
    canvas.addEventListener('duel-opponent-move', this.onOpponentMove)

    // Opponent shot — denormalise target coords
    this.onOpponentShoot = (e: Event) => {
      const { ntx, nty } = (e as CustomEvent<{ ntx: number; nty: number }>).detail
      this.spawnBullet(
        this.opponentSprite.x, this.opponentSprite.y,
        ntx * this.W, nty * this.H, false, 0xff4444,
      )
      soundManager.laser()
    }
    canvas.addEventListener('duel-opponent-shoot', this.onOpponentShoot)

    // Opponent HP sync from WS — update opponent HP bar
    this.onOpponentHpSync = (e: Event) => {
      const { hp } = (e as CustomEvent<{ hp: number }>).detail
      this.opponentStats.hp = Math.max(0, hp)
      this.emitHp()
      if (this.opponentStats.hp <= 0 && !this.ended) this.endDuel(true)
    }
    canvas.addEventListener('duel-opponent-hp-sync', this.onOpponentHpSync)

    // Force-end from WS duel.result
    this.onForceEnd = (e: Event) => {
      const { won } = (e as CustomEvent<{ won: boolean }>).detail
      this.endDuel(won)
    }
    canvas.addEventListener('duel-force-end', this.onForceEnd)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('mousemove', this.docMouseMove)
      canvas.removeEventListener('duel-opponent-move',    this.onOpponentMove)
      canvas.removeEventListener('duel-opponent-shoot',   this.onOpponentShoot)
      canvas.removeEventListener('duel-opponent-hp-sync', this.onOpponentHpSync)
      canvas.removeEventListener('duel-force-end',        this.onForceEnd)
      canvas.removeAttribute('data-duel')
    })
  }

  // ─── Shooting ───────────────────────────────────────────────────────────────

  private playerShoot() {
    if (this.ended) return
    const now = this.time.now
    if (now - this.playerLastShot < 1000 / this.playerStats.fireRate) return
    this.playerLastShot = now

    this.spawnBullet(this.playerSprite.x, this.playerSprite.y, this.mouseX, this.mouseY, true, 0x00e5ff)
    soundManager.laser()

    // Normalise shoot target so it maps correctly on any screen size
    this.sys.canvas.dispatchEvent(new CustomEvent('duel-shoot', {
      detail: {
        ntx: +(this.mouseX / this.W).toFixed(4),
        nty: +(this.mouseY / this.H).toFixed(4),
      },
    }))
  }

  private spawnBullet(fx: number, fy: number, tx: number, ty: number, fromPlayer: boolean, color: number) {
    const speed = 320
    const dx = tx - fx, dy = ty - fy
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const vx = (dx / len) * speed, vy = (dy / len) * speed

    const gfx = this.add.graphics().setDepth(12)
    gfx.x = fx; gfx.y = fy
    gfx.fillStyle(color, 1);     gfx.fillCircle(0, 0, 5)
    gfx.fillStyle(0xffffff, 0.9); gfx.fillCircle(0, 0, 2.5)
    // Outer glow
    gfx.fillStyle(color, 0.25); gfx.fillCircle(0, 0, 9)

    const trail = this.add.graphics().setDepth(11)

    this.bullets.push({ gfx, trail, vx, vy, fromPlayer, color })
  }

  // ─── Hit detection ──────────────────────────────────────────────────────────

  private checkBulletHits(delta: number) {
    const dt = delta / 1000
    this.bullets = this.bullets.filter((b) => {
      // Update trail
      const px = b.gfx.x, py = b.gfx.y
      b.gfx.x += b.vx * dt
      b.gfx.y += b.vy * dt

      // Draw motion trail
      b.trail.clear()
      b.trail.lineStyle(2, b.color, 0.35)
      b.trail.lineBetween(px, py, b.gfx.x, b.gfx.y)
      b.trail.lineStyle(1, 0xffffff, 0.15)
      b.trail.lineBetween(px, py, b.gfx.x, b.gfx.y)

      // Out of bounds
      if (b.gfx.x < -20 || b.gfx.x > this.W + 20 || b.gfx.y < -20 || b.gfx.y > this.H + 20) {
        b.gfx.destroy(); b.trail.destroy(); return false
      }

      // Hit check
      const target = b.fromPlayer ? this.opponentSprite : this.playerSprite
      const stats  = b.fromPlayer ? this.opponentStats  : this.playerStats
      const dx = b.gfx.x - target.x, dy = b.gfx.y - target.y

      if (Math.sqrt(dx * dx + dy * dy) < 36) {
        if (Math.random() > stats.dodge) {
          const dmg = b.fromPlayer ? this.playerStats.damage : this.opponentStats.damage
          stats.hp = Math.max(0, stats.hp - dmg)
          this.spawnHitFX(b.gfx.x, b.gfx.y, b.color)
          this.emitHp()

          if (b.fromPlayer) {
            // MY bullet hit opponent — sync opponent HP to their device
            this.sys.canvas.dispatchEvent(new CustomEvent('duel-hit-send', {
              detail: { myHp: this.playerStats.hp },
            }))
          } else {
            // Opponent bullet hit me — shake screen + sync my HP
            const intensity = 0.008 + (dmg / this.playerStats.maxHp) * 0.025
            this.cameras.main.shake(140, intensity)
            this.sys.canvas.dispatchEvent(new CustomEvent('duel-hp-broadcast', {
              detail: { hp: this.playerStats.hp },
            }))
          }

          if (stats.hp <= 0) this.endDuel(b.fromPlayer)
        } else {
          // Dodge — show dodge text
          this.spawnDodgeFX(target.x, target.y)
        }
        b.gfx.destroy(); b.trail.destroy(); return false
      }
      return true
    })
  }

  // ─── Opponent movement (WS position interpolation) ──────────────────────────

  private updateOpponent(delta: number) {
    const speed = 200 * (delta / 1000)
    const dx = this.opponentTargetX - this.opponentSprite.x
    const dy = this.opponentTargetY - this.opponentSprite.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > 2) {
      this.opponentSprite.x += (dx / dist) * Math.min(speed, dist)
      this.opponentSprite.y += (dy / dist) * Math.min(speed, dist)
    }
  }

  // ─── Player movement ────────────────────────────────────────────────────────

  private updatePlayerMovement(delta: number) {
    const speed = this.playerStats.speed * (delta / 1000)
    const dx = this.mouseX - this.playerSprite.x
    const dy = this.mouseY - this.playerSprite.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > 4) {
      this.playerSprite.x += (dx / dist) * Math.min(speed, dist)
      this.playerSprite.y += (dy / dist) * Math.min(speed, dist)
    }
    this.playerSprite.x = Phaser.Math.Clamp(this.playerSprite.x, 10, this.W - 10)
    this.playerSprite.y = Phaser.Math.Clamp(this.playerSprite.y, 10, this.H - 10)

    // Broadcast normalised position every 50ms (0–1 range, screen-size independent)
    const now = this.time.now
    if (now - this.lastHpSync > 50) {
      this.lastHpSync = now
      this.sys.canvas.dispatchEvent(new CustomEvent('duel-move', {
        detail: {
          nx: +(this.playerSprite.x / this.W).toFixed(4),
          ny: +(this.playerSprite.y / this.H).toFixed(4),
        },
      }))
    }
  }

  // ─── Effects ─────────────────────────────────────────────────────────────────

  private spawnHitFX(x: number, y: number, color: number) {
    soundManager.explosion()
    const sparks = 10
    for (let i = 0; i < sparks; i++) {
      const angle = (i / sparks) * Math.PI * 2 + Math.random() * 0.3
      const dist  = 14 + Math.random() * 22
      const spark = this.add.graphics().setDepth(15)
      spark.fillStyle(i % 3 === 0 ? 0xffffff : color, 1)
      spark.fillCircle(x, y, 2 + Math.random() * 2.5)
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist,
        alpha: 0, scaleX: 0.1, scaleY: 0.1,
        duration: 280 + Math.random() * 180, ease: 'Power2.Out',
        onComplete: () => spark.destroy(),
      })
    }
    // Flash ring
    const ring = this.add.graphics().setDepth(14)
    ring.lineStyle(3, color, 1); ring.strokeCircle(x, y, 6)
    this.tweens.add({
      targets: ring, scaleX: 3.5, scaleY: 3.5, alpha: 0,
      duration: 220, ease: 'Power2.Out',
      onComplete: () => ring.destroy(),
    })
  }

  private spawnDodgeFX(x: number, y: number) {
    const txt = this.add.text(x, y - 24, 'DODGE', {
      fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold',
      color: '#a78bfa', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(16)
    this.tweens.add({
      targets: txt, y: y - 52, alpha: 0, duration: 700, ease: 'Power2.Out',
      onComplete: () => txt.destroy(),
    })
  }

  // ─── HP events ───────────────────────────────────────────────────────────────

  private emitHp() {
    this.sys.canvas.dispatchEvent(new CustomEvent('duel-hp', {
      detail: {
        playerHp:      Math.max(0, this.playerStats.hp),
        playerMaxHp:   this.playerStats.maxHp,
        opponentHp:    Math.max(0, this.opponentStats.hp),
        opponentMaxHp: this.opponentStats.maxHp,
      },
    }))
  }

  // ─── End ─────────────────────────────────────────────────────────────────────

  private endDuel(won: boolean) {
    if (this.ended) return
    this.ended = true

    const loser = won ? this.opponentSprite : this.playerSprite
    this.tweens.killTweensOf(loser)

    // Big shake when defeated
    this.cameras.main.shake(600, 0.028)

    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(i * 100, () => {
        this.spawnHitFX(
          loser.x + (Math.random() - 0.5) * 50,
          loser.y + (Math.random() - 0.5) * 50,
          won ? 0xff4444 : 0x00e5ff,
        )
      })
    }

    this.tweens.add({
      targets: loser, alpha: 0, scaleX: 0.08, scaleY: 0.08, angle: 380,
      duration: 700, delay: 250, ease: 'Power2.In',
      onComplete: () => {
        const W = this.W, H = this.H
        const overlay = this.add.graphics().setDepth(20)
        overlay.fillStyle(won ? 0x003300 : 0x330000, 0); overlay.fillRect(0, 0, W, H)
        this.tweens.add({ targets: overlay, alpha: 0.55, duration: 400 })

        const msg = won ? '⚡ ПОБЕДА' : '✗ ПОРАЖЕНИЕ'
        const col = won ? '#39ff14' : '#ff4444'
        const txt = this.add.text(W / 2, H / 2, msg, {
          fontSize: '34px', fontFamily: 'monospace', fontStyle: 'bold',
          color: col, stroke: '#000', strokeThickness: 6,
        }).setOrigin(0.5).setDepth(21).setScale(0.25).setAlpha(0)
        this.tweens.add({ targets: txt, alpha: 1, scaleX: 1, scaleY: 1, duration: 420, ease: 'Back.Out' })

        this.time.delayedCall(1500, () => this.cfg.onEnd(won))
      },
    })
  }

  // ─── Textures ─────────────────────────────────────────────────────────────────

  private generateTextures() {
    for (const t of [1, 2, 3] as const) {
      const key = `duel_drone_${t}`
      if (!this.textures.exists(key)) {
        const g = this.make.graphics({ x: 0, y: 0 }, false)
        paintDrone(g, false, t); g.generateTexture(key, 128, 128); g.destroy()
      }
    }
  }

  // ─── Update ───────────────────────────────────────────────────────────────────

  update(_time: number, delta: number) {
    if (this.ended) return
    this.updatePlayerMovement(delta)
    this.updateOpponent(delta)
    this.checkBulletHits(delta)

    // Redraw upgrade + HP visual effects every frame
    this.drawDroneEffects(
      this.playerGfx, this.playerSprite,
      this.cfg.playerUpgrades, this.playerStats.hp, this.playerStats.maxHp, true,
    )
    this.drawDroneEffects(
      this.opponentGfx, this.opponentSprite,
      this.cfg.opponentUpgrades, this.opponentStats.hp, this.opponentStats.maxHp, false,
    )
  }
}
