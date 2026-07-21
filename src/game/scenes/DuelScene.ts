import Phaser from 'phaser'
import { DuelDroneSprite } from '../utils/duelDroneSprite'
import { soundManager } from '../utils/soundManager'

// ─── Public API ───────────────────────────────────────────────────────────

export interface DuelSceneConfig {
  duelId:   number
  myUserId: number
  onEnd:    (won: boolean) => void
}

// WS payload shapes (mirror server) ────────────────────────────────────────
interface DuelStartState {
  duel_id: number; challenger_id: number; defender_id: number
  players: Array<{ user_id: number; max_hp: number; hp: number; x: number; y: number }>
}
interface DuelState { players: Array<{ user_id: number; x: number; y: number; hp: number }> }
interface DuelShot  { from: number; x: number; y: number; vx: number; vy: number }
interface DuelHit   { shooter: number; target: number; x: number; y: number; damage: number }
interface DuelDodge { target: number; x: number; y: number }

interface Bullet {
  gfx:  Phaser.GameObjects.Graphics
  vx: number; vy: number
  color: number
}

/**
 * Duel arena — Phaser side. Owns two drones (DuelDroneSprite), their turret
 * barrels, in-flight bullets, muzzle-flash + hit + dodge FX, and the death
 * explosion. HUD (D-pad, aim-dial, HP bars, music toggle, overlays) is
 * drawn by DuelBattleScreen in React on top of this canvas.
 *
 * Communication is via DOM CustomEvents on `sys.canvas` (marked with
 * `data-duel`):
 *
 *   React → Phaser
 *     duel-start-state {duel_id, challenger_id, defender_id, players[…]}
 *     duel-state       {players[…]}
 *     duel-shot-fired  {from, x, y, vx, vy}
 *     duel-hit         {shooter, target, x, y, damage}
 *     duel-dodge       {target, x, y}
 *     duel-force-end   {won}
 *     duel-aim         {angleRad}           // player's aim rotation
 *
 *   Phaser → React    (nothing — React reads WS itself for HUD state)
 */
export class DuelScene extends Phaser.Scene {
  private cfg!: DuelSceneConfig

  // Drones (DuelDroneSprite = container of body sprite + 4 rotor sprites).
  private me!: DuelDroneSprite
  private foe!: DuelDroneSprite
  private myGunGfx!:  Phaser.GameObjects.Graphics
  private foeGunGfx!: Phaser.GameObjects.Graphics

  // Authoritative snapshot (normalised 0..1)
  private myServerX = 0.25; private myServerY = 0.5
  private foeServerX = 0.75; private foeServerY = 0.5
  private myHP = 100; private myMaxHP = 100
  private foeHP = 100; private foeMaxHP = 100
  private started = false

  // Turret aim (radians)
  private myAim  = 0
  private foeAim = Math.PI

  // Recoil offsets, decay to 0
  private myRecoil = 0
  private foeRecoil = 0

  private bullets: Bullet[] = []
  private ended = false

  // Canvas dims
  private W = 0
  private H = 0

  // Listeners
  private onStart!:     (e: Event) => void
  private onState!:     (e: Event) => void
  private onShot!:      (e: Event) => void
  private onHit!:       (e: Event) => void
  private onDodge!:     (e: Event) => void
  private onAim!:       (e: Event) => void
  private onForceEnd!:  (e: Event) => void

  constructor() { super({ key: 'DuelScene' }) }

  setConfig(cfg: DuelSceneConfig) { this.cfg = cfg }

  // ─── Lifecycle ─────────────────────────────────────────────────────────
  create() {
    const { width, height } = this.scale
    this.W = width; this.H = height

    this.drawArena(width, height)

    // Drones: player = cyan (type 1), opponent = red (type 2).
    this.me  = new DuelDroneSprite(this, width * this.myServerX,  height * this.myServerY,  1, { scale: 0.9 })
    this.foe = new DuelDroneSprite(this, width * this.foeServerX, height * this.foeServerY, 2, { scale: 0.9 })
    this.me.setDepth(10); this.foe.setDepth(10)

    // Gun-barrel overlays sit ABOVE the drone body but below the halo of FX.
    this.myGunGfx  = this.add.graphics().setDepth(11)
    this.foeGunGfx = this.add.graphics().setDepth(11)

    this.wireEvents()

    // Mark the canvas so the websocket layer can dispatch events onto it,
    // and drain any start_state that was buffered before we mounted.
    const canvas = this.sys.canvas
    canvas.setAttribute('data-duel', '1')
    const anyWin = window as any
    if (anyWin.__lastDuelStartState) {
      canvas.dispatchEvent(new CustomEvent('duel-start-state', { detail: anyWin.__lastDuelStartState }))
      anyWin.__lastDuelStartState = null
    }
  }

  // ─── Arena backdrop (stars + centre line + faint glow) ─────────────────
  private drawArena(W: number, H: number) {
    const bg = this.add.graphics().setDepth(0)
    bg.fillStyle(0x02060e, 1); bg.fillRect(0, 0, W, H)
    // Stars
    for (let i = 0; i < 220; i++) {
      const a = Math.random() * 0.85 + 0.1
      bg.fillStyle(0xffffff, a)
      bg.fillCircle(Math.random() * W, Math.random() * H, Math.random() * 1.4 + 0.2)
    }
    // Nebula glows
    bg.fillStyle(0x0ea5e9, 0.05); bg.fillEllipse(W * 0.22, H * 0.32, 260, 120)
    bg.fillStyle(0xff5e7a, 0.04); bg.fillEllipse(W * 0.78, H * 0.68, 220, 110)

    // Centre divider
    const div = this.add.graphics().setDepth(1)
    div.fillStyle(0x28e0ff, 0.06); div.fillRect(W / 2 - 1, 0, 2, H)
    div.lineStyle(1, 0x28e0ff, 0.28); div.lineBetween(W / 2, 0, W / 2, H)
  }

  // ─── React → Phaser event wiring ───────────────────────────────────────
  private wireEvents() {
    const canvas = this.sys.canvas

    this.onStart = (e) => {
      const p = (e as CustomEvent<DuelStartState>).detail
      const me  = p.players.find((pl) => pl.user_id === this.cfg.myUserId)
      const foe = p.players.find((pl) => pl.user_id !== this.cfg.myUserId)
      if (me)  {
        this.myHP = me.hp; this.myMaxHP = me.max_hp
        this.myServerX = me.x; this.myServerY = me.y
        this.me.setPosition(this.W * me.x, this.H * me.y)
      }
      if (foe) {
        this.foeHP = foe.hp; this.foeMaxHP = foe.max_hp
        this.foeServerX = foe.x; this.foeServerY = foe.y
        this.foe.setPosition(this.W * foe.x, this.H * foe.y)
      }
      this.started = true
    }
    canvas.addEventListener('duel-start-state', this.onStart)

    this.onState = (e) => {
      const p = (e as CustomEvent<DuelState>).detail
      const me  = p.players.find((pl) => pl.user_id === this.cfg.myUserId)
      const foe = p.players.find((pl) => pl.user_id !== this.cfg.myUserId)
      if (me)  { this.myHP  = me.hp;  this.myServerX = me.x;  this.myServerY = me.y }
      if (foe) { this.foeHP = foe.hp; this.foeServerX = foe.x; this.foeServerY = foe.y }
    }
    canvas.addEventListener('duel-state', this.onState)

    this.onShot = (e) => {
      const p = (e as CustomEvent<DuelShot>).detail
      const mine = p.from === this.cfg.myUserId
      this.spawnBullet(p.x, p.y, p.vx, p.vy, mine ? 0x28e0ff : 0xff5e7a)
      this.spawnMuzzleFlash(p.x * this.W, p.y * this.H, Math.atan2(p.vy, p.vx), mine ? 0x28e0ff : 0xff5e7a)
      if (mine) this.myRecoil = 6
      else {
        this.foeRecoil = 6
        // Rotate opponent's turret to aim at us (server doesn't send their aim).
        this.foeAim = Math.atan2(this.myServerY - this.foeServerY, this.myServerX - this.foeServerX)
      }
      soundManager.laser()
    }
    canvas.addEventListener('duel-shot-fired', this.onShot)

    this.onHit = (e) => {
      const p = (e as CustomEvent<DuelHit>).detail
      const targetIsMe = p.target === this.cfg.myUserId
      this.spawnHitFX(p.x * this.W, p.y * this.H, targetIsMe ? 0xff5e7a : 0x28e0ff)
      if (targetIsMe) {
        this.cameras.main.shake(140, 0.008 + (p.damage / Math.max(1, this.myMaxHP)) * 0.025)
      }
    }
    canvas.addEventListener('duel-hit', this.onHit)

    this.onDodge = (e) => {
      const p = (e as CustomEvent<DuelDodge>).detail
      this.spawnDodgeFX(p.x * this.W, p.y * this.H)
    }
    canvas.addEventListener('duel-dodge', this.onDodge)

    this.onAim = (e) => {
      const { angleRad } = (e as CustomEvent<{ angleRad: number }>).detail
      this.myAim = angleRad
    }
    canvas.addEventListener('duel-aim', this.onAim)

    this.onForceEnd = (e) => {
      const { won } = (e as CustomEvent<{ won: boolean }>).detail
      this.endDuel(won)
    }
    canvas.addEventListener('duel-force-end', this.onForceEnd)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      canvas.removeEventListener('duel-start-state', this.onStart)
      canvas.removeEventListener('duel-state',       this.onState)
      canvas.removeEventListener('duel-shot-fired',  this.onShot)
      canvas.removeEventListener('duel-hit',         this.onHit)
      canvas.removeEventListener('duel-dodge',       this.onDodge)
      canvas.removeEventListener('duel-aim',         this.onAim)
      canvas.removeEventListener('duel-force-end',   this.onForceEnd)
      canvas.removeAttribute('data-duel')
    })
  }

  // ─── Turret barrel (twin-tube blaster) ─────────────────────────────────
  private drawGun(g: Phaser.GameObjects.Graphics, drone: DuelDroneSprite, angle: number, mine: boolean, recoil: number) {
    g.clear()
    const cx = drone.x, cy = drone.y
    const barrel = mine ? 0x7ff0ff : 0xff8a5a
    const body   = mine ? 0x08161f : 0x1a0810
    const edge   = mine ? 0x28e0ff : 0xff5e7a

    const cos = Math.cos(angle), sin = Math.sin(angle)
    const nx = -sin, ny = cos
    const pivotDist = 6 - recoil
    const barrelLen = 30
    const barrelGap = 3.2
    const thick = 2.3

    const px = cx + cos * pivotDist
    const py = cy + sin * pivotDist
    const tx = px + cos * barrelLen
    const ty = py + sin * barrelLen

    for (const s of [-barrelGap, barrelGap]) {
      const ox = nx * s, oy = ny * s
      const p1x = px + ox, p1y = py + oy
      const t1x = tx + ox, t1y = ty + oy
      const hnx = nx * (thick / 2), hny = ny * (thick / 2)
      g.fillStyle(body, 0.95)
      g.beginPath()
      g.moveTo(p1x - hnx, p1y - hny); g.lineTo(p1x + hnx, p1y + hny)
      g.lineTo(t1x + hnx, t1y + hny); g.lineTo(t1x - hnx, t1y - hny)
      g.closePath(); g.fillPath()
      g.lineStyle(0.8, edge, 0.75); g.strokeCircle(t1x, t1y, 1.6)
      g.fillStyle(barrel, 1); g.fillCircle(t1x, t1y, 1.6)
    }
    // Rear pivot cap
    g.fillStyle(body, 0.95); g.fillCircle(cx + cos * 3, cy + sin * 3, 4.8)
    g.lineStyle(1, edge, 0.85); g.strokeCircle(cx + cos * 3, cy + sin * 3, 4.8)
    g.fillStyle(edge, 0.9); g.fillCircle(cx + cos * 3, cy + sin * 3, 2)
    // Muzzle glow
    g.fillStyle(barrel, 0.7); g.fillCircle(tx, ty, 3.5)
    g.fillStyle(0xffffff, 0.6); g.fillCircle(tx, ty, 1.6)
  }

  // ─── Bullets, muzzle flash, hit FX, dodge FX ───────────────────────────
  private spawnBullet(nx: number, ny: number, vnx: number, vny: number, color: number) {
    const gfx = this.add.graphics().setDepth(12)
    gfx.x = nx * this.W
    gfx.y = ny * this.H
    gfx.rotation = Math.atan2(vny, vnx)
    gfx.fillStyle(color, 0.35);   gfx.fillRoundedRect(-6, -6, 36, 12, 6)
    gfx.fillStyle(color, 0.9);    gfx.fillRoundedRect(-2, -3, 30, 6, 3)
    gfx.fillStyle(0xffffff, 0.95); gfx.fillRoundedRect(6, -1.5, 22, 3, 1.5)
    gfx.fillStyle(0xffffff, 1);   gfx.fillCircle(26, 0, 2.5)
    this.bullets.push({ gfx, vx: vnx, vy: vny, color })
  }

  private advanceBullets(delta: number) {
    const dt = delta / 1000
    this.bullets = this.bullets.filter((b) => {
      b.gfx.x += b.vx * this.W * dt
      b.gfx.y += b.vy * this.H * dt
      if (b.gfx.x < -30 || b.gfx.x > this.W + 30 || b.gfx.y < -30 || b.gfx.y > this.H + 30) {
        b.gfx.destroy(); return false
      }
      return true
    })
  }

  private spawnMuzzleFlash(x: number, y: number, angle: number, color: number) {
    const f = this.add.graphics().setDepth(13)
    f.x = x; f.y = y; f.rotation = angle
    f.fillStyle(0xffffff, 0.95); f.fillCircle(0, 0, 7)
    f.fillStyle(color, 0.7);     f.fillCircle(0, 0, 12)
    f.fillStyle(0xffffff, 0.55); f.fillRect(0, -1.5, 18, 3)
    f.fillStyle(color, 0.35);    f.fillRect(0, -3, 26, 6)
    this.tweens.add({
      targets: f, alpha: 0, scaleX: 1.6, scaleY: 1.6,
      duration: 180, ease: 'Power2.Out',
      onComplete: () => f.destroy(),
    })
  }

  private spawnHitFX(x: number, y: number, color: number) {
    soundManager.explosion()
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.3
      const dist = 14 + Math.random() * 22
      const sp = this.add.graphics().setDepth(15)
      sp.fillStyle(i % 3 === 0 ? 0xffffff : color, 1)
      sp.fillCircle(x, y, 2 + Math.random() * 2.5)
      this.tweens.add({
        targets: sp, x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist,
        alpha: 0, scaleX: 0.1, scaleY: 0.1,
        duration: 280 + Math.random() * 180, ease: 'Power2.Out',
        onComplete: () => sp.destroy(),
      })
    }
    const ring = this.add.graphics().setDepth(14)
    ring.lineStyle(3, color, 1); ring.strokeCircle(x, y, 6)
    this.tweens.add({ targets: ring, scaleX: 3.5, scaleY: 3.5, alpha: 0, duration: 220, ease: 'Power2.Out',
      onComplete: () => ring.destroy() })
  }

  private spawnDodgeFX(x: number, y: number) {
    const t = this.add.text(x, y - 24, 'DODGE', {
      fontSize: '10px', fontFamily: 'monospace', fontStyle: 'bold',
      color: '#a78bfa', stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(16)
    this.tweens.add({ targets: t, y: y - 52, alpha: 0, duration: 700, ease: 'Power2.Out',
      onComplete: () => t.destroy() })
  }

  // ─── Death sequence: shockwave, sparks, debris, big shake ──────────────
  private deathExplode(sprite: DuelDroneSprite, mine: boolean) {
    const cx = sprite.x, cy = sprite.y
    const tint = mine ? 0x28e0ff : 0xff5e7a

    // Fade drone
    this.tweens.add({ targets: sprite, alpha: 0, scaleX: 0.15, scaleY: 0.15, angle: 320,
      duration: 600, ease: 'Power2.In' })

    // Core flash
    const core = this.add.graphics().setDepth(20)
    core.fillStyle(0xffffff, 1); core.fillCircle(cx, cy, 30)
    core.fillStyle(tint, 0.65); core.fillCircle(cx, cy, 50)
    this.tweens.add({ targets: core, scaleX: 3, scaleY: 3, alpha: 0, duration: 500, ease: 'Cubic.Out',
      onComplete: () => core.destroy() })

    // Shockwave ring
    const ring = this.add.graphics().setDepth(19)
    ring.lineStyle(4, tint, 1); ring.strokeCircle(cx, cy, 40)
    this.tweens.add({ targets: ring, scaleX: 3.5, scaleY: 3.5, alpha: 0, duration: 700, ease: 'Cubic.Out',
      onComplete: () => ring.destroy() })

    // 30 sparks radiate outward
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2 + Math.random() * 0.3
      const dist = 60 + Math.random() * 60
      const sp = this.add.graphics().setDepth(18)
      sp.fillStyle(i % 3 === 0 ? 0xffffff : tint, 1)
      sp.fillCircle(cx, cy, 2 + Math.random() * 2)
      this.tweens.add({ targets: sp,
        x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
        alpha: 0, scaleX: 0.1, scaleY: 0.1,
        duration: 500 + Math.random() * 300, ease: 'Cubic.Out',
        onComplete: () => sp.destroy() })
    }
    // 6 debris chunks fly further
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.5
      const dist = 100 + Math.random() * 70
      const d = this.add.graphics().setDepth(18)
      d.fillStyle(tint, 1); d.fillRect(-4, -1.5, 8, 3)
      d.x = cx; d.y = cy
      this.tweens.add({ targets: d,
        x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist,
        rotation: Math.random() * Math.PI * 4, alpha: 0,
        duration: 600 + Math.random() * 200, ease: 'Cubic.Out',
        onComplete: () => d.destroy() })
    }

    this.cameras.main.shake(500, 0.02)
    soundManager.explosion()
  }

  private endDuel(won: boolean) {
    if (this.ended) return
    this.ended = true
    this.deathExplode(won ? this.foe : this.me, !won)
    this.time.delayedCall(850, () => this.cfg.onEnd(won))
  }

  // ─── Frame loop ────────────────────────────────────────────────────────
  update(_t: number, delta: number) {
    if (this.ended) return
    // Spin rotors
    this.me.spin(delta)
    this.foe.spin(delta)

    // Reconcile positions toward server snapshot (20Hz updates, 60fps render).
    const lerp = 0.30
    const mx = this.myServerX * this.W, my = this.myServerY * this.H
    const fx = this.foeServerX * this.W, fy = this.foeServerY * this.H
    this.me.x  += (mx - this.me.x)  * lerp
    this.me.y  += (my - this.me.y)  * lerp
    this.foe.x += (fx - this.foe.x) * lerp
    this.foe.y += (fy - this.foe.y) * lerp

    // Decay recoil (~180ms half-life)
    const decay = Math.pow(0.5, delta / 90)
    this.myRecoil  *= decay
    this.foeRecoil *= decay

    // Turrets
    this.drawGun(this.myGunGfx,  this.me,  this.myAim,  true,  this.myRecoil)
    this.drawGun(this.foeGunGfx, this.foe, this.foeAim, false, this.foeRecoil)

    // Bullets
    this.advanceBullets(delta)

    // Low-HP blink (mine + opp) — 25 % threshold, ramps as HP drops.
    this.applyLowHp(this.me,  this.myHP,  this.myMaxHP)
    this.applyLowHp(this.foe, this.foeHP, this.foeMaxHP)
  }

  private applyLowHp(sprite: DuelDroneSprite, hp: number, maxHp: number) {
    if (maxHp <= 0) { sprite.alpha = 1; return }
    const pct = hp / maxHp
    if (pct >= 0.25 || hp <= 0) { sprite.alpha = 1; return }
    const period = Math.max(70, 400 * (pct / 0.25))
    // triangle wave 0..1 based on time
    const t = (this.time.now % period) / period
    const wave = t < 0.5 ? t * 2 : (1 - t) * 2
    sprite.alpha = 0.35 + wave * 0.65
  }
}
