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

// duel.start_state — one-shot bootstrap from the server (MaxHP + spawn positions).
interface DuelStartStatePayload {
  duel_id: number
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

// duel.state — 20Hz tick with authoritative positions + HP.
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
  vx: number    // in NORMALISED units/sec (server-space)
  vy: number
  color: number
}

// ─── Scene ────────────────────────────────────────────────────────────────

export class DuelScene extends Phaser.Scene {
  private cfg!: DuelSceneConfig

  // Sprites + overlay graphics
  private playerSprite!:  Phaser.GameObjects.Image
  private playerGfx!:     Phaser.GameObjects.Graphics
  private opponentSprite!: Phaser.GameObjects.Image
  private opponentGfx!:    Phaser.GameObjects.Graphics

  // Cursor / touch target — normalised 0..1, sent on every frame (throttled)
  private targetNX = 0.25
  private targetNY = 0.75

  // Server-authoritative snapshot (updated on duel.state / duel.start_state)
  private myHP = 100
  private myMaxHP = 100
  private oppHP = 100
  private oppMaxHP = 100
  private oppTargetX = 0.75  // last known server position (normalised)
  private oppTargetY = 0.25
  private myServerX  = 0.25  // used to reconcile local prediction drift
  private myServerY  = 0.75

  // Bullets — spawned only when the server emits duel.shot_fired
  private bullets: Bullet[] = []

  // Throttling of client-originated inputs
  private lastMoveEmit = 0
  private lastShootEmit = 0

  // WS listeners (unregistered on shutdown)
  private docMouseMove!:      (e: MouseEvent) => void
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

  create() {
    const { width: W, height: H } = this.scale
    this.W = W; this.H = H

    this.generateTextures()
    this.drawArena(W, H)
    this.spawnDrones(W, H)
    this.setupInput(W, H)

    // Optimistic default HP so the UI has numbers before duel.start_state lands.
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

    this.playerGfx   = this.add.graphics().setDepth(9)
    this.opponentGfx = this.add.graphics().setDepth(9)

    // Idle hover — server position updates coexist with these tweens; the
    // reconciler snaps to server X only, letting Y hover freely.
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

  // ─── Input ─────────────────────────────────────────────────────────────

  private setupInput(W: number, H: number) {
    const canvas = this.sys.canvas

    this.docMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = Phaser.Math.Clamp(e.clientX - rect.left, 4, W - 4)
      const y = Phaser.Math.Clamp(e.clientY - rect.top,  4, H - 4)
      this.targetNX = x / this.W
      this.targetNY = y / this.H
    }
    document.addEventListener('mousemove', this.docMouseMove)

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) {
        const x = Phaser.Math.Clamp(p.x, 4, W - 4)
        const y = Phaser.Math.Clamp(p.y, 4, H - 4)
        this.targetNX = x / this.W
        this.targetNY = y / this.H
      }
    })

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) return
      const dx = p.x - p.downX
      const dy = p.y - p.downY
      if (Math.sqrt(dx * dx + dy * dy) < 15) {
        this.emitShoot(p.x / this.W, p.y / this.H)
      }
    })

    // ── Server-driven WS events ──────────────────────────────────────────

    this.onDuelStartState = (e: Event) => {
      const p = (e as CustomEvent<DuelStartStatePayload>).detail
      const me  = p.players.find((pl) => pl.user_id === this.cfg.myUserId)
      const opp = p.players.find((pl) => pl.user_id !== this.cfg.myUserId)
      if (me)  { this.myHP  = me.hp;  this.myMaxHP  = me.max_hp;  this.myServerX = me.x;  this.myServerY = me.y  }
      if (opp) { this.oppHP = opp.hp; this.oppMaxHP = opp.max_hp; this.oppTargetX = opp.x; this.oppTargetY = opp.y }
      this.emitHp()
    }
    canvas.addEventListener('duel-start-state', this.onDuelStartState)

    this.onDuelState = (e: Event) => {
      const p = (e as CustomEvent<DuelStatePayload>).detail
      const me  = p.players.find((pl) => pl.user_id === this.cfg.myUserId)
      const opp = p.players.find((pl) => pl.user_id !== this.cfg.myUserId)
      if (me)  { this.myHP  = me.hp;  this.myServerX = me.x;   this.myServerY = me.y  }
      if (opp) { this.oppHP = opp.hp; this.oppTargetX = opp.x; this.oppTargetY = opp.y }
      this.emitHp()
    }
    canvas.addEventListener('duel-state', this.onDuelState)

    this.onDuelShotFired = (e: Event) => {
      const p = (e as CustomEvent<DuelShotPayload>).detail
      const mine = p.from === this.cfg.myUserId
      const color = mine ? 0x00e5ff : 0xff4444
      this.spawnBullet(p.x, p.y, p.vx, p.vy, color)
      soundManager.laser()
    }
    canvas.addEventListener('duel-shot-fired', this.onDuelShotFired)

    this.onDuelHit = (e: Event) => {
      const p = (e as CustomEvent<DuelHitPayload>).detail
      const targetIsMe = p.target === this.cfg.myUserId
      this.spawnHitFX(p.x * this.W, p.y * this.H, targetIsMe ? 0xff4444 : 0x00e5ff)
      if (targetIsMe) {
        const intensity = 0.008 + (p.damage / Math.max(1, this.myMaxHP)) * 0.025
        this.cameras.main.shake(140, intensity)
      }
    }
    canvas.addEventListener('duel-hit', this.onDuelHit)

    this.onDuelDodge = (e: Event) => {
      const p = (e as CustomEvent<DuelDodgePayload>).detail
      this.spawnDodgeFX(p.x * this.W, p.y * this.H)
    }
    canvas.addEventListener('duel-dodge', this.onDuelDodge)

    this.onForceEnd = (e: Event) => {
      const { won } = (e as CustomEvent<{ won: boolean }>).detail
      this.endDuel(won)
    }
    canvas.addEventListener('duel-force-end', this.onForceEnd)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('mousemove', this.docMouseMove)
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

  private emitMoveTick() {
    // Throttle to 50ms — matches the server tick rate. Sub-tick input rate
    // buys nothing; extra frames just get coalesced by the session queue.
    const now = this.time.now
    if (now - this.lastMoveEmit < 50) return
    this.lastMoveEmit = now
    this.sys.canvas.dispatchEvent(new CustomEvent('duel-move', {
      detail: { nx: +this.targetNX.toFixed(4), ny: +this.targetNY.toFixed(4) },
    }))
  }

  private emitShoot(ntx: number, nty: number) {
    // Client rate-limit; the server cooldown is authoritative.
    const now = this.time.now
    if (now - this.lastShootEmit < 100) return
    this.lastShootEmit = now
    this.sys.canvas.dispatchEvent(new CustomEvent('duel-shoot', {
      detail: { ntx: +ntx.toFixed(4), nty: +nty.toFixed(4) },
    }))
  }

  // ─── Rendering: bullets, hit FX, dodge FX ──────────────────────────────

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

      // Bullets vanish off-arena; hit detection lives on the server, so we
      // don't check collisions here. The server-driven duel-hit event
      // shows sparks at exactly the moment damage lands.
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

  // ─── HP surface event (React consumes this) ────────────────────────────

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

  // ─── End sequence ──────────────────────────────────────────────────────

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

  // ─── Textures ──────────────────────────────────────────────────────────

  private generateTextures() {
    for (const t of [1, 2, 3] as const) {
      const key = `duel_drone_${t}`
      if (!this.textures.exists(key)) {
        const g = this.make.graphics({ x: 0, y: 0 }, false)
        paintDrone(g, false, t); g.generateTexture(key, 128, 128); g.destroy()
      }
    }
  }

  // ─── Update loop ───────────────────────────────────────────────────────

  update(_time: number, delta: number) {
    if (this.ended) return

    // 1. Send our latest cursor as the move target (server clamps by speed).
    this.emitMoveTick()

    // 2. Reconcile local sprite positions toward the last server snapshot.
    //    Server updates arrive at 20Hz — we lerp between them at 60fps for
    //    a smooth render. Reconciliation strength: full snap on big drift,
    //    proportional catch-up otherwise.
    const lerp = 0.30
    const px = this.myServerX * this.W
    const py = this.myServerY * this.H
    this.playerSprite.x += (px - this.playerSprite.x) * lerp
    // Y hover tween handles vertical bob — only snap Y if the drift is huge.
    if (Math.abs(py - this.playerSprite.y) > 40) {
      this.playerSprite.y = py
    }

    const ox = this.oppTargetX * this.W
    const oy = this.oppTargetY * this.H
    this.opponentSprite.x += (ox - this.opponentSprite.x) * lerp
    if (Math.abs(oy - this.opponentSprite.y) > 40) {
      this.opponentSprite.y = oy
    }

    // 3. Move rendered bullets forward.
    this.advanceBullets(delta)

    // 4. Redraw upgrade + HP glow around each drone every frame.
    this.drawDroneEffects(this.playerGfx,   this.playerSprite,   this.cfg.playerUpgrades,   this.myHP,  this.myMaxHP)
    this.drawDroneEffects(this.opponentGfx, this.opponentSprite, this.cfg.opponentUpgrades, this.oppHP, this.oppMaxHP)
  }
}
