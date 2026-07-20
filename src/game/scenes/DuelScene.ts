import Phaser from 'phaser'
import { paintDrone } from '../utils/droneGraphics'
import { soundManager } from '../utils/soundManager'

// ─── Types ────────────────────────────────────────────────────────────────

export interface DuelSceneConfig {
  duelId:           number
  myUserId:         number
  playerDroneType:  1 | 2 | 3
  playerUpgrades:   Record<string, number>
  opponentUserId:   number
  opponentName:     string
  opponentType:     1 | 2 | 3
  opponentUpgrades: Record<string, number>
  onEnd: (won: boolean) => void
}

interface DuelStartStatePayload {
  duel_id: number
  challenger_id: number
  defender_id: number
  tick_rate: number
  bullet_speed: number
  players: Array<{
    user_id: number
    drone_code: number
    upgrades: Record<string, number>
    max_hp: number
    hp: number
    x: number
    y: number
    stats: { damage: number; fire_rate: number; speed: number; dodge: number; hitbox: number }
  }>
}

interface DuelStatePayload {
  duel_id: number
  t: number
  players: Array<{ user_id: number; x: number; y: number; hp: number }>
}

interface DuelShotPayload  { bullet_id: number; from: number; x: number; y: number; vx: number; vy: number }
interface DuelHitPayload   { shooter: number; target: number; x: number; y: number; damage: number; remaining: number }
interface DuelDodgePayload { target: number; x: number; y: number }

interface Bullet {
  gfx: Phaser.GameObjects.Graphics
  trail: Phaser.GameObjects.Graphics
  vx: number
  vy: number
  color: number
}

type DpadDir = 'up' | 'down' | 'left' | 'right'

// ─── Scene ────────────────────────────────────────────────────────────────

export class DuelScene extends Phaser.Scene {
  private cfg!: DuelSceneConfig

  // Sprites
  private playerSprite!:   Phaser.GameObjects.Image
  private opponentSprite!: Phaser.GameObjects.Image
  private playerGfx!:      Phaser.GameObjects.Graphics
  private opponentGfx!:    Phaser.GameObjects.Graphics
  private playerGunGfx!:   Phaser.GameObjects.Graphics
  private opponentGunGfx!: Phaser.GameObjects.Graphics

  // Server-authoritative snapshot
  private myHP = 100
  private myMaxHP = 100
  private oppHP = 100
  private oppMaxHP = 100
  private oppTargetX = 0.75
  private oppTargetY = 0.25
  private myServerX  = 0.25
  private myServerY  = 0.75

  // Bullets
  private bullets: Bullet[] = []

  // Input state — D-pad and aim
  private dpad: Record<DpadDir, boolean> = { up: false, down: false, left: false, right: false }
  private aimAngle = -Math.PI / 4 // radians, 0=right, points toward opponent by default (up-right)
  private lastMoveEmit = 0
  private lastShootEmit = 0

  // HUD graphics
  private dpadGfx!:      Phaser.GameObjects.Graphics
  private aimGfx!:       Phaser.GameObjects.Graphics
  private hudInteractive: Array<Phaser.GameObjects.Zone> = []

  // Aim-stick center in screen px + radius
  private aimCX = 0
  private aimCY = 0
  private aimR  = 50

  // View orientation (defender's world is rotated 180°)
  private flipped = false

  // WS listeners
  private onDuelStartState!:  (e: Event) => void
  private onDuelState!:       (e: Event) => void
  private onDuelShotFired!:   (e: Event) => void
  private onDuelHit!:         (e: Event) => void
  private onDuelDodge!:       (e: Event) => void
  private onForceEnd!:        (e: Event) => void

  private ended = false
  private W = 0
  private H = 0

  constructor() { super({ key: 'DuelScene' }) }

  setConfig(cfg: DuelSceneConfig) { this.cfg = cfg }

  // ─── World ↔ Screen ────────────────────────────────────────────────────

  private worldToScreenX(nx: number) { return this.flipped ? 1 - nx : nx }
  private worldToScreenY(ny: number) { return this.flipped ? 1 - ny : ny }
  private screenToWorldX(nx: number) { return this.flipped ? 1 - nx : nx }
  private screenToWorldY(ny: number) { return this.flipped ? 1 - ny : ny }

  create() {
    const { width: W, height: H } = this.scale
    this.W = W; this.H = H

    this.generateTextures()
    this.drawArena(W, H)
    this.spawnDrones(W, H)
    this.setupHUD(W, H)
    this.setupInput()

    this.emitHp()
    this.sys.canvas.setAttribute('data-duel', '1')
  }

  // ─── Arena ─────────────────────────────────────────────────────────────

  private drawArena(W: number, H: number) {
    const bg = this.add.graphics().setDepth(0)
    bg.fillStyle(0x050a12, 1); bg.fillRect(0, 0, W, H)

    for (let i = 0; i < 200; i++) {
      const a = Math.random() * 0.8 + 0.1
      bg.fillStyle(0xffffff, a)
      bg.fillCircle(Math.random() * W, Math.random() * H, Math.random() * 1.4 + 0.2)
    }
    bg.fillStyle(0x0ea5e9, 0.04); bg.fillEllipse(W * 0.2, H * 0.3, 260, 120)
    bg.fillStyle(0x8b5cf6, 0.05); bg.fillEllipse(W * 0.8, H * 0.7, 200, 100)

    const grid = this.add.graphics().setDepth(1)
    grid.lineStyle(1, 0x00e5ff, 0.05)
    for (let x = 0; x < W; x += 44) grid.lineBetween(x, 0, x, H)
    for (let y = 0; y < H; y += 44) grid.lineBetween(0, y, W, y)

    const div = this.add.graphics().setDepth(2)
    div.fillStyle(0x00e5ff, 0.06); div.fillRect(W / 2 - 1, 0, 2, H)
    div.lineStyle(1, 0x00e5ff, 0.35); div.lineBetween(W / 2, 0, W / 2, H)

    this.add.text(W * 0.25, 20, 'ВАШ ДРОН', {
      fontSize: '9px', fontFamily: 'monospace', color: '#00e5ff',
    }).setOrigin(0.5).setAlpha(0.4).setDepth(3)
    this.add.text(W * 0.75, 20, this.cfg.opponentName.slice(0, 12).toUpperCase(), {
      fontSize: '9px', fontFamily: 'monospace', color: '#ff4444',
    }).setOrigin(0.5).setAlpha(0.4).setDepth(3)
  }

  // ─── Drones ────────────────────────────────────────────────────────────

  private spawnDrones(W: number, H: number) {
    const pKey = `duel_drone_${this.cfg.playerDroneType}`
    const oKey = `duel_drone_${this.cfg.opponentType}`

    this.playerSprite = this.add.image(W * 0.25, H * 0.75, pKey)
      .setScale(0.72).setDepth(10)
    this.opponentSprite = this.add.image(W * 0.75, H * 0.25, oKey)
      .setScale(0.72).setDepth(10).setFlipX(true)

    this.playerGfx     = this.add.graphics().setDepth(9)
    this.opponentGfx   = this.add.graphics().setDepth(9)
    this.playerGunGfx  = this.add.graphics().setDepth(11)
    this.opponentGunGfx = this.add.graphics().setDepth(11)

    this.tweens.add({ targets: this.playerSprite,   y: this.playerSprite.y - 6,   duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
    this.tweens.add({ targets: this.opponentSprite, y: this.opponentSprite.y - 6, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 300 })
  }

  private drawDroneEffects(
    g: Phaser.GameObjects.Graphics,
    sprite: Phaser.GameObjects.Image,
    upgrades: Record<string, number>,
    hp: number,
    maxHp: number,
  ) {
    g.clear()
    const cx = sprite.x, cy = sprite.y
    const pct = Math.max(0, hp / maxHp)
    const glow = pct > 0.6 ? 0x00e5ff : pct > 0.3 ? 0xf59e0b : 0xff2222

    g.fillStyle(glow, 0.09); g.fillCircle(cx, cy, 38)
    g.lineStyle(2, glow, 0.55 * pct); g.strokeCircle(cx, cy, 36)

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

    if (pct < 0.3) {
      const flash = Math.sin(this.time.now / 120) * 0.5 + 0.5
      g.fillStyle(0xff2222, flash * 0.15)
      g.fillCircle(cx, cy, 42)
    }
  }

  /** Small red barrel sticking out of a drone in the aim direction. */
  private drawGunBarrel(g: Phaser.GameObjects.Graphics, sprite: Phaser.GameObjects.Image, angle: number) {
    g.clear()
    const cx = sprite.x, cy = sprite.y
    const len = 22
    const w = 5
    // Rectangle rotated by `angle`, pivoting on the drone centre.
    const cos = Math.cos(angle), sin = Math.sin(angle)
    const tip = { x: cx + cos * len,        y: cy + sin * len }
    const px  = { x: cx + cos * 6,          y: cy + sin * 6 } // barrel base 6px from centre
    const nl  = { x: -sin * (w / 2),        y: cos * (w / 2) }
    // Body
    g.fillStyle(0xff2222, 0.95)
    g.beginPath()
    g.moveTo(px.x - nl.x, px.y - nl.y)
    g.lineTo(px.x + nl.x, px.y + nl.y)
    g.lineTo(tip.x + nl.x, tip.y + nl.y)
    g.lineTo(tip.x - nl.x, tip.y - nl.y)
    g.closePath()
    g.fillPath()
    // Muzzle glow
    g.fillStyle(0xffff33, 0.75)
    g.fillCircle(tip.x, tip.y, 3)
    g.fillStyle(0xff2222, 0.35)
    g.fillCircle(tip.x, tip.y, 6)
  }

  // ─── HUD (D-pad + aim-stick) ──────────────────────────────────────────

  private setupHUD(W: number, H: number) {
    // ── D-pad in the bottom-left corner ─────────────────────────────────
    const dpadCX = 68
    const dpadCY = H - 76
    const btnR   = 26
    const spacing = 30

    this.dpadGfx = this.add.graphics().setDepth(30)
    this.dpadGfx.setScrollFactor(0)

    const dpadZones: Array<[DpadDir, number, number]> = [
      ['up',    dpadCX,           dpadCY - spacing],
      ['down',  dpadCX,           dpadCY + spacing],
      ['left',  dpadCX - spacing, dpadCY],
      ['right', dpadCX + spacing, dpadCY],
    ]
    for (const [dir, x, y] of dpadZones) {
      const z = this.add.zone(x, y, btnR * 2, btnR * 2)
        .setInteractive({ useHandCursor: true }).setDepth(31)
      z.on('pointerdown', () => { this.dpad[dir] = true })
      z.on('pointerup',   () => { this.dpad[dir] = false })
      z.on('pointerout',  () => { this.dpad[dir] = false })
      z.on('pointerupoutside', () => { this.dpad[dir] = false })
      this.hudInteractive.push(z)
    }

    // ── Aim-stick in the bottom-right corner ────────────────────────────
    this.aimCX = W - 78
    this.aimCY = H - 76
    this.aimR  = 50

    this.aimGfx = this.add.graphics().setDepth(30)
    this.aimGfx.setScrollFactor(0)

    const aimZone = this.add.zone(this.aimCX, this.aimCY, this.aimR * 2 + 30, this.aimR * 2 + 30)
      .setInteractive({ useHandCursor: true }).setDepth(31)

    // Track drag: pointerdown+move updates aim angle; pointerup at "gun tip"
    // vicinity fires. To keep it simple: any pointerup inside the ring fires
    // (angle is whatever we last dragged to). Very short taps also fire.
    let dragging = false
    aimZone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      dragging = true
      this.updateAimFromPointer(p.x, p.y)
    })
    aimZone.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (dragging) this.updateAimFromPointer(p.x, p.y)
    })
    aimZone.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (dragging) this.updateAimFromPointer(p.x, p.y)
      dragging = false
      this.emitShootAlongAim()
    })
    aimZone.on('pointerupoutside', () => { dragging = false })
    this.hudInteractive.push(aimZone)
  }

  private updateAimFromPointer(px: number, py: number) {
    const dx = px - this.aimCX
    const dy = py - this.aimCY
    if (dx === 0 && dy === 0) return
    this.aimAngle = Math.atan2(dy, dx)
  }

  private drawHUD() {
    // ── D-pad ───────────────────────────────────────────────────────────
    const g = this.dpadGfx
    g.clear()
    const dpadCX = 68
    const dpadCY = this.H - 76
    const btnR   = 26
    const spacing = 30

    const draw = (cx: number, cy: number, active: boolean, glyph: 'up'|'down'|'left'|'right') => {
      g.fillStyle(active ? 0x00e5ff : 0x0a1929, active ? 0.35 : 0.55)
      g.fillCircle(cx, cy, btnR)
      g.lineStyle(1.5, 0x00e5ff, active ? 0.9 : 0.4)
      g.strokeCircle(cx, cy, btnR)
      // Arrow glyph
      g.fillStyle(0x00e5ff, active ? 1 : 0.7)
      g.beginPath()
      const t = 10
      switch (glyph) {
        case 'up':    g.moveTo(cx, cy - t);      g.lineTo(cx - t, cy + t/2); g.lineTo(cx + t, cy + t/2); break
        case 'down':  g.moveTo(cx, cy + t);      g.lineTo(cx - t, cy - t/2); g.lineTo(cx + t, cy - t/2); break
        case 'left':  g.moveTo(cx - t, cy);      g.lineTo(cx + t/2, cy - t); g.lineTo(cx + t/2, cy + t); break
        case 'right': g.moveTo(cx + t, cy);      g.lineTo(cx - t/2, cy - t); g.lineTo(cx - t/2, cy + t); break
      }
      g.closePath()
      g.fillPath()
    }
    draw(dpadCX,           dpadCY - spacing, this.dpad.up,    'up')
    draw(dpadCX,           dpadCY + spacing, this.dpad.down,  'down')
    draw(dpadCX - spacing, dpadCY,           this.dpad.left,  'left')
    draw(dpadCX + spacing, dpadCY,           this.dpad.right, 'right')

    // ── Aim-stick with a small red gun ──────────────────────────────────
    const a = this.aimGfx
    a.clear()
    // Ring
    a.fillStyle(0x1a0a0a, 0.5); a.fillCircle(this.aimCX, this.aimCY, this.aimR)
    a.lineStyle(2, 0xff4444, 0.6); a.strokeCircle(this.aimCX, this.aimCY, this.aimR)
    // Inner tick marks
    for (let i = 0; i < 12; i++) {
      const th = (i / 12) * Math.PI * 2
      const r0 = this.aimR - 8, r1 = this.aimR - 2
      a.lineStyle(1, 0xff4444, 0.4)
      a.lineBetween(
        this.aimCX + Math.cos(th) * r0, this.aimCY + Math.sin(th) * r0,
        this.aimCX + Math.cos(th) * r1, this.aimCY + Math.sin(th) * r1,
      )
    }
    // Red gun in aim direction
    const cos = Math.cos(this.aimAngle), sin = Math.sin(this.aimAngle)
    const len = this.aimR - 10
    const w = 6
    const tip = { x: this.aimCX + cos * len, y: this.aimCY + sin * len }
    const base = { x: this.aimCX + cos * 4,  y: this.aimCY + sin * 4 }
    const nl  = { x: -sin * (w / 2),         y:  cos * (w / 2) }
    a.fillStyle(0xff2222, 0.95)
    a.beginPath()
    a.moveTo(base.x - nl.x, base.y - nl.y)
    a.lineTo(base.x + nl.x, base.y + nl.y)
    a.lineTo(tip.x  + nl.x, tip.y  + nl.y)
    a.lineTo(tip.x  - nl.x, tip.y  - nl.y)
    a.closePath()
    a.fillPath()
    // Muzzle spark
    a.fillStyle(0xffff33, 0.8); a.fillCircle(tip.x, tip.y, 3)
    a.fillStyle(0xff2222, 0.35); a.fillCircle(tip.x, tip.y, 6)
    // Central pivot
    a.fillStyle(0xff4444, 0.9); a.fillCircle(this.aimCX, this.aimCY, 3)
  }

  // ─── Input setup ───────────────────────────────────────────────────────

  private setupInput() {
    const canvas = this.sys.canvas

    // Keyboard support: arrow keys + WASD move, Space shoots.
    const keys = this.input.keyboard
    if (keys) {
      const bind = (codes: string[], dir: DpadDir) => {
        for (const c of codes) {
          keys.on('keydown-' + c, () => { this.dpad[dir] = true })
          keys.on('keyup-' + c,   () => { this.dpad[dir] = false })
        }
      }
      bind(['UP','W'],    'up')
      bind(['DOWN','S'],  'down')
      bind(['LEFT','A'],  'left')
      bind(['RIGHT','D'], 'right')
      keys.on('keydown-SPACE', () => this.emitShootAlongAim())
    }

    this.onDuelStartState = (e: Event) => {
      const p = (e as CustomEvent<DuelStartStatePayload>).detail
      this.flipped = p.defender_id === this.cfg.myUserId
      const me  = p.players.find((pl) => pl.user_id === this.cfg.myUserId)
      const opp = p.players.find((pl) => pl.user_id !== this.cfg.myUserId)
      if (me)  {
        this.myHP = me.hp; this.myMaxHP = me.max_hp
        this.myServerX = this.worldToScreenX(me.x); this.myServerY = this.worldToScreenY(me.y)
      }
      if (opp) {
        this.oppHP = opp.hp; this.oppMaxHP = opp.max_hp
        this.oppTargetX = this.worldToScreenX(opp.x); this.oppTargetY = this.worldToScreenY(opp.y)
      }
      // Default aim points toward opponent so the barrel isn't facing self.
      this.aimAngle = Math.atan2(this.oppTargetY - this.myServerY, this.oppTargetX - this.myServerX)
      this.emitHp()
    }
    canvas.addEventListener('duel-start-state', this.onDuelStartState)

    this.onDuelState = (e: Event) => {
      const p = (e as CustomEvent<DuelStatePayload>).detail
      const me  = p.players.find((pl) => pl.user_id === this.cfg.myUserId)
      const opp = p.players.find((pl) => pl.user_id !== this.cfg.myUserId)
      if (me)  { this.myHP  = me.hp;  this.myServerX  = this.worldToScreenX(me.x);  this.myServerY = this.worldToScreenY(me.y) }
      if (opp) { this.oppHP = opp.hp; this.oppTargetX = this.worldToScreenX(opp.x); this.oppTargetY = this.worldToScreenY(opp.y) }
      this.emitHp()
    }
    canvas.addEventListener('duel-state', this.onDuelState)

    this.onDuelShotFired = (e: Event) => {
      const p = (e as CustomEvent<DuelShotPayload>).detail
      const mine = p.from === this.cfg.myUserId
      const color = mine ? 0x00e5ff : 0xff4444
      const sx  = this.worldToScreenX(p.x)
      const sy  = this.worldToScreenY(p.y)
      const svx = this.flipped ? -p.vx : p.vx
      const svy = this.flipped ? -p.vy : p.vy
      this.spawnBullet(sx, sy, svx, svy, color)
      soundManager.laser()
    }
    canvas.addEventListener('duel-shot-fired', this.onDuelShotFired)

    this.onDuelHit = (e: Event) => {
      const p = (e as CustomEvent<DuelHitPayload>).detail
      const targetIsMe = p.target === this.cfg.myUserId
      const sx = this.worldToScreenX(p.x) * this.W
      const sy = this.worldToScreenY(p.y) * this.H
      this.spawnHitFX(sx, sy, targetIsMe ? 0xff4444 : 0x00e5ff)
      if (targetIsMe) {
        const intensity = 0.008 + (p.damage / Math.max(1, this.myMaxHP)) * 0.025
        this.cameras.main.shake(140, intensity)
      }
    }
    canvas.addEventListener('duel-hit', this.onDuelHit)

    this.onDuelDodge = (e: Event) => {
      const p = (e as CustomEvent<DuelDodgePayload>).detail
      const sx = this.worldToScreenX(p.x) * this.W
      const sy = this.worldToScreenY(p.y) * this.H
      this.spawnDodgeFX(sx, sy)
    }
    canvas.addEventListener('duel-dodge', this.onDuelDodge)

    this.onForceEnd = (e: Event) => {
      const { won } = (e as CustomEvent<{ won: boolean }>).detail
      this.endDuel(won)
    }
    canvas.addEventListener('duel-force-end', this.onForceEnd)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      canvas.removeEventListener('duel-start-state', this.onDuelStartState)
      canvas.removeEventListener('duel-state',       this.onDuelState)
      canvas.removeEventListener('duel-shot-fired',  this.onDuelShotFired)
      canvas.removeEventListener('duel-hit',         this.onDuelHit)
      canvas.removeEventListener('duel-dodge',       this.onDuelDodge)
      canvas.removeEventListener('duel-force-end',   this.onForceEnd)
      canvas.removeAttribute('data-duel')
    })
  }

  // ─── Input emission ────────────────────────────────────────────────────

  /** Send the current move target to the server, computed from dpad state. */
  private emitMoveTick() {
    const now = this.time.now
    if (now - this.lastMoveEmit < 50) return
    this.lastMoveEmit = now

    // Direction vector from D-pad. Neutral (nothing pressed) → stand still by
    // targeting the current server-side position.
    let dx = 0, dy = 0
    if (this.dpad.left)  dx -= 1
    if (this.dpad.right) dx += 1
    if (this.dpad.up)    dy -= 1
    if (this.dpad.down)  dy += 1

    let targetScreenX: number, targetScreenY: number
    if (dx === 0 && dy === 0) {
      // Standing: keep the target where we currently are so server doesn't drift.
      targetScreenX = this.playerSprite.x / this.W
      targetScreenY = this.playerSprite.y / this.H
    } else {
      // Aim the target far in the pressed direction; the server clamps by speed.
      const len = Math.hypot(dx, dy) || 1
      dx /= len; dy /= len
      targetScreenX = clamp01(this.playerSprite.x / this.W + dx * 0.5)
      targetScreenY = clamp01(this.playerSprite.y / this.H + dy * 0.5)
    }

    const worldX = this.screenToWorldX(targetScreenX)
    const worldY = this.screenToWorldY(targetScreenY)
    this.sys.canvas.dispatchEvent(new CustomEvent('duel-move', {
      detail: { nx: +worldX.toFixed(4), ny: +worldY.toFixed(4) },
    }))
  }

  private emitShootAlongAim() {
    const now = this.time.now
    if (now - this.lastShootEmit < 100) return
    this.lastShootEmit = now

    // Aim direction is in screen-space (unaffected by flip since it's a vector
    // rendered on-screen). Compute the target point along that ray so the
    // server can spawn a bullet flying that way.
    const cos = Math.cos(this.aimAngle), sin = Math.sin(this.aimAngle)
    const originScreenX = this.playerSprite.x / this.W
    const originScreenY = this.playerSprite.y / this.H
    const targetScreenX = clamp01(originScreenX + cos * 1.2)
    const targetScreenY = clamp01(originScreenY + sin * 1.2)

    const ntx = this.screenToWorldX(targetScreenX)
    const nty = this.screenToWorldY(targetScreenY)
    this.sys.canvas.dispatchEvent(new CustomEvent('duel-shoot', {
      detail: { ntx: +ntx.toFixed(4), nty: +nty.toFixed(4) },
    }))
  }

  // ─── Bullets / FX ──────────────────────────────────────────────────────

  private spawnBullet(nx: number, ny: number, vnx: number, vny: number, color: number) {
    const gfx = this.add.graphics().setDepth(12)
    gfx.x = nx * this.W
    gfx.y = ny * this.H
    gfx.fillStyle(color, 1);       gfx.fillCircle(0, 0, 5)
    gfx.fillStyle(0xffffff, 0.9);  gfx.fillCircle(0, 0, 2.5)
    gfx.fillStyle(color, 0.25);    gfx.fillCircle(0, 0, 9)

    const trail = this.add.graphics().setDepth(11)
    this.bullets.push({ gfx, trail, vx: vnx, vy: vny, color })
  }

  private advanceBullets(delta: number) {
    const dt = delta / 1000
    this.bullets = this.bullets.filter((b) => {
      const px = b.gfx.x, py = b.gfx.y
      b.gfx.x += b.vx * this.W * dt
      b.gfx.y += b.vy * this.H * dt

      b.trail.clear()
      b.trail.lineStyle(2, b.color, 0.35)
      b.trail.lineBetween(px, py, b.gfx.x, b.gfx.y)
      b.trail.lineStyle(1, 0xffffff, 0.15)
      b.trail.lineBetween(px, py, b.gfx.x, b.gfx.y)

      if (b.gfx.x < -20 || b.gfx.x > this.W + 20 || b.gfx.y < -20 || b.gfx.y > this.H + 20) {
        b.gfx.destroy(); b.trail.destroy(); return false
      }
      return true
    })
  }

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

  private emitHp() {
    this.sys.canvas.dispatchEvent(new CustomEvent('duel-hp', {
      detail: {
        playerHp:      Math.max(0, this.myHP),
        playerMaxHp:   this.myMaxHP,
        opponentHp:    Math.max(0, this.oppHP),
        opponentMaxHp: this.oppMaxHP,
      },
    }))
  }

  private endDuel(won: boolean) {
    if (this.ended) return
    this.ended = true

    const loser = won ? this.opponentSprite : this.playerSprite
    this.tweens.killTweensOf(loser)
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

  private generateTextures() {
    for (const t of [1, 2, 3] as const) {
      const key = `duel_drone_${t}`
      if (!this.textures.exists(key)) {
        const g = this.make.graphics({ x: 0, y: 0 }, false)
        paintDrone(g, false, t); g.generateTexture(key, 128, 128); g.destroy()
      }
    }
  }

  update(_time: number, delta: number) {
    if (this.ended) return

    this.emitMoveTick()

    // Reconcile local sprites toward server snapshot (20Hz updates, 60fps render).
    const lerp = 0.30
    const px = this.myServerX * this.W
    const py = this.myServerY * this.H
    this.playerSprite.x += (px - this.playerSprite.x) * lerp
    if (Math.abs(py - this.playerSprite.y) > 40) this.playerSprite.y = py

    const ox = this.oppTargetX * this.W
    const oy = this.oppTargetY * this.H
    this.opponentSprite.x += (ox - this.opponentSprite.x) * lerp
    if (Math.abs(oy - this.opponentSprite.y) > 40) this.opponentSprite.y = oy

    this.advanceBullets(delta)

    // Effects + gun barrels
    this.drawDroneEffects(this.playerGfx,   this.playerSprite,   this.cfg.playerUpgrades,   this.myHP,  this.myMaxHP)
    this.drawDroneEffects(this.opponentGfx, this.opponentSprite, this.cfg.opponentUpgrades, this.oppHP, this.oppMaxHP)
    this.drawGunBarrel(this.playerGunGfx,   this.playerSprite,   this.aimAngle)
    // Opponent barrel: point roughly toward us. We don't get their aim over WS
    // (yet), so approximate by direction to my sprite — plausible & readable.
    const oppAim = Math.atan2(this.playerSprite.y - this.opponentSprite.y, this.playerSprite.x - this.opponentSprite.x)
    this.drawGunBarrel(this.opponentGunGfx, this.opponentSprite, oppAim)

    // HUD
    this.drawHUD()
  }
}

function clamp01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v }
