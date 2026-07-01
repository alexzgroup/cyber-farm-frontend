import Phaser from 'phaser'
import i18n from '../../i18n'
import { useGameStore, DRONE_UPGRADES, type Drone, type Turret } from '../../store/gameStore'
import { getDroneTextureName, getFarmTurretTextureName } from '../utils/droneGraphics'
import { soundManager } from '../utils/soundManager'
import { syncPositions as apiSyncPositions } from '../../api'

interface FloatingText { text: Phaser.GameObjects.Text; vy: number; life: number }

const GRID_COLS   = 3
const DRONE_CELL  = 200
const TURRET_CELL = 200
const POSITIONS_KEY = 'cyber-farm-positions'
const DRONE_START_Y = 80   // world Y where drones begin

export class FarmScene extends Phaser.Scene {
  private droneSprites:   Map<string, Phaser.GameObjects.Image> = new Map()
  private turretSprites:  Map<string, Phaser.GameObjects.Image> = new Map()
  private brokenLabels:   Map<string, Phaser.GameObjects.Text>  = new Map()
  private levelLabels:    Map<string, Phaser.GameObjects.Text>  = new Map()
  private turretLabels:   Map<string, Phaser.GameObjects.Text>  = new Map()
  private hoverTweens:    Map<string, Phaser.Tweens.Tween>      = new Map()
  private smokeTimers:    Map<string, Phaser.Time.TimerEvent>   = new Map()
  private floatingTexts:  FloatingText[] = []
  private emitter!:       Phaser.GameObjects.Particles.ParticleEmitter
  private unsubscribeStore?: () => void
  private isAlive         = false
  private isDraggingUnit  = false
  private worldH          = 2000

  constructor() { super({ key: 'FarmScene' }) }

  create() {
    const { width: W, height: H } = this.scale
    const { drones, turrets } = useGameStore.getState()

    this.worldH = this.calcWorldH(H, drones.length, turrets.length)

    this.drawBackground(W, this.worldH, drones.length)
    // Grid removed by design — replaced with volumetric nebula + lightning.
    this.createLightningLayer(W, this.worldH)
    this.createParticles()
    this.spawnInitialDrones()
    this.spawnInitialTurrets()
    this.setupDrag()
    this.setupCameraControls(W, this.worldH)

    this.isAlive = true
    this.unsubscribeStore = useGameStore.subscribe((state) => {
      this.syncDrones(state.drones)
    })

    // Passive income floats — every second
    this.time.addEvent({
      delay: 1000, repeat: -1,
      callback: this.tickPassiveFloats,
      callbackScope: this,
    })

    const cleanup = () => {
      this.isAlive = false
      this.unsubscribeStore?.()
      this.smokeTimers.forEach((t) => t.destroy())
      this.smokeTimers.clear()
      // Restore sprite alphas
      this.droneSprites.forEach((s) => { if (s.scene) s.setAlpha(1) })
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup)
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup)
  }

  // ─── World height calculation ────────────────────────────────────────────────
  private calcWorldH(H: number, droneCount: number, turretCount: number): number {
    const dc = Math.max(droneCount, 1)
    const tc = Math.max(turretCount, 0)
    const droneRows  = Math.ceil(dc / GRID_COLS)
    const turretRows = Math.ceil(tc / GRID_COLS)
    const droneZoneH  = DRONE_START_Y + droneRows * DRONE_CELL
    const separatorH  = 60
    const turretZoneH = tc > 0 ? separatorH + turretRows * TURRET_CELL + 60 : 80
    return Math.max(H * 2.2, droneZoneH + turretZoneH)
  }

  private separatorY(droneCount: number): number {
    const rows = Math.ceil(Math.max(droneCount, 1) / GRID_COLS)
    return DRONE_START_Y + rows * DRONE_CELL + 177
  }

  // ─── Background: layered "cyber space" — deep nebula, star field, animated
  //     scanlines, radial pulse rings, faint horizon and speed-lines. Extends
  //     2000px beyond the world so zooming out never exposes raw black. ─────
  private drawBackground(W: number, worldH: number, droneCount: number) {
    const sepY = this.separatorY(droneCount)
    const PAD  = 2000

    // 1) Base deep-space fill — nearly black with a faint blue tint.
    const bg = this.add.graphics().setDepth(-100)
    bg.fillStyle(0x05070f, 1)
    bg.fillRect(-PAD, -PAD, W + PAD * 2, worldH + PAD * 2)

    // 2) Nebula clouds — big translucent circles in cyan / violet.
    //    Placed randomly across the world so scrolling reveals new pockets.
    const nebula = this.add.graphics().setDepth(-95)
    const NEBULA_COLORS = [0x1a3a7a, 0x3a1a7a, 0x0a2a5a, 0x5a1a4a]
    for (let i = 0; i < 22; i++) {
      const nx = Phaser.Math.Between(-PAD, W + PAD)
      const ny = Phaser.Math.Between(-PAD, worldH + PAD)
      const nr = Phaser.Math.Between(140, 320)
      const nc = NEBULA_COLORS[i % NEBULA_COLORS.length]
      nebula.fillStyle(nc, 0.04); nebula.fillCircle(nx, ny, nr)
      nebula.fillStyle(nc, 0.06); nebula.fillCircle(nx, ny, nr * 0.6)
      nebula.fillStyle(nc, 0.08); nebula.fillCircle(nx, ny, nr * 0.3)
    }

    // 3) Star field — 240 pinpricks, tiny with sparser brighter ones.
    const stars = this.add.graphics().setDepth(-94)
    for (let i = 0; i < 240; i++) {
      const sx = Phaser.Math.Between(-PAD, W + PAD)
      const sy = Phaser.Math.Between(-PAD, worldH + PAD)
      const bright = Math.random() < 0.15
      stars.fillStyle(bright ? 0xffffff : 0x9fc4ff, bright ? 0.8 : 0.35)
      stars.fillCircle(sx, sy, bright ? 1.2 : 0.6)
    }

    // 4) Radial pulse rings — three concentric rings from the world centre.
    //    Animated in the update loop via scale tween below.
    const cx = W / 2
    const cy = worldH / 2
    for (let i = 0; i < 3; i++) {
      const ring = this.add.graphics().setDepth(-90)
      ring.lineStyle(2, 0x00e5ff, 0.14)
      ring.strokeCircle(0, 0, 200)
      ring.setPosition(cx, cy)
      this.tweens.add({
        targets: ring,
        scale: { from: 0.4, to: 3.5 },
        alpha: { from: 0.7, to: 0 },
        duration: 5200,
        delay: i * 1700,
        repeat: -1,
        ease: 'Cubic.easeOut',
      })
    }

    // 5) Diagonal "data streams" — thin lines drifting across the field.
    const streams = this.add.graphics().setDepth(-88)
    streams.lineStyle(1, 0x00e5ff, 0.10)
    for (let i = 0; i < 14; i++) {
      const y0 = Phaser.Math.Between(-PAD, worldH + PAD)
      streams.lineBetween(-PAD, y0, W + PAD, y0 + Phaser.Math.Between(-30, 30))
    }
    streams.lineStyle(1, 0xa855f7, 0.08)
    for (let i = 0; i < 8; i++) {
      const y0 = Phaser.Math.Between(-PAD, worldH + PAD)
      streams.lineBetween(-PAD, y0, W + PAD, y0 + Phaser.Math.Between(-30, 30))
    }

    // 6) Zone tints — subtle so the base nebula still shows through.
    bg.fillStyle(0x0d1420, 0.55)
    bg.fillRect(-PAD, -PAD, W + PAD * 2, sepY + PAD)
    bg.fillStyle(0x0a1e10, 0.55)
    bg.fillRect(-PAD, sepY, W + PAD * 2, worldH - sepY + PAD)

    // 7) Separator with soft neon halo.
    bg.lineStyle(6, 0x00e5ff, 0.10)
    bg.lineBetween(-PAD, sepY, W + PAD, sepY)
    bg.lineStyle(2, 0x00e5ff, 0.42)
    bg.lineBetween(-PAD, sepY, W + PAD, sepY)

    // 8) Zone labels.
    this.add.text(10, 68, 'DRONE ZONE', {
      fontSize: '9px', fontFamily: 'monospace', color: '#00e5ff',
    }).setAlpha(0.35).setDepth(-1)
    this.add.text(10, sepY + 8, 'DEFENSE ZONE', {
      fontSize: '9px', fontFamily: 'monospace', color: '#00cc44',
    }).setAlpha(0.35).setDepth(-1)

    // 9) Star twinkle — a light tween on a subset of stars so the sky feels
    //    alive. We overlay a second stars graphic pulsing gently in and out.
    const twinkle = this.add.graphics().setDepth(-93)
    twinkle.fillStyle(0xffffff, 0.9)
    for (let i = 0; i < 40; i++) {
      const sx = Phaser.Math.Between(-PAD, W + PAD)
      const sy = Phaser.Math.Between(-PAD, worldH + PAD)
      twinkle.fillCircle(sx, sy, 0.9)
    }
    this.tweens.add({
      targets: twinkle,
      alpha: { from: 0.35, to: 0.85 },
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  /**
   * Farming lightning bolts — small forked strokes that briefly flash around
   * the drones, signalling that the farm is actively mining. One graphics layer
   * is reused: every ~700ms we clear it and draw a fresh cluster of 2-4 bolts
   * with random paths.
   */
  private createLightningLayer(W: number, worldH: number) {
    const g = this.add.graphics().setDepth(-10)

    const drawBolt = (x0: number, y0: number, x1: number, y1: number, color: number) => {
      // Split the run into 6-9 segments and jitter each vertex sideways so
      // the bolt looks organic instead of straight.
      const segs = Phaser.Math.Between(6, 9)
      const dx = (x1 - x0) / segs
      const dy = (y1 - y0) / segs
      let px = x0, py = y0
      g.lineStyle(3, color, 0.35)
      for (let i = 1; i <= segs; i++) {
        const jitter = 12
        const nx = x0 + dx * i + Phaser.Math.Between(-jitter, jitter)
        const ny = y0 + dy * i + Phaser.Math.Between(-jitter, jitter)
        g.lineBetween(px, py, nx, ny)
        // Occasional branch — shorter, softer.
        if (Math.random() < 0.35 && i < segs) {
          const bx = nx + Phaser.Math.Between(-24, 24)
          const by = ny + Phaser.Math.Between(-10, 24)
          g.lineStyle(2, color, 0.18)
          g.lineBetween(nx, ny, bx, by)
          g.lineStyle(3, color, 0.35)
        }
        px = nx; py = ny
      }
      // Bright core along the same path — thinner, more opaque.
      g.lineStyle(1, 0xffffff, 0.75)
      g.lineBetween(x0, y0, x1, y1)
    }

    const strike = () => {
      g.clear()
      // 3-6 bolts per strike — feels like the whole farm is crackling with
      // mining energy instead of a single sparse zap.
      const bolts = Phaser.Math.Between(3, 6)
      for (let i = 0; i < bolts; i++) {
        const x = Phaser.Math.Between(20, W - 20)
        const y = Phaser.Math.Between(60, worldH - 60)
        const len = Phaser.Math.Between(60, 140)
        const dir = Math.random() < 0.5 ? -1 : 1
        // Pick a colour that pops on the dark nebula.
        const col = [0x00e5ff, 0xa855f7, 0x39ff14, 0xffd700][Phaser.Math.Between(0, 3)]
        drawBolt(x, y - len / 2, x + dir * Phaser.Math.Between(20, 60), y + len / 2, col)
      }
      // Fade the whole flash out.
      g.setAlpha(1)
      this.tweens.add({
        targets: g,
        alpha: { from: 1, to: 0 },
        duration: 520,
        ease: 'Cubic.easeOut',
      })
    }

    // Kick off first strike almost immediately and repeat frequently so the
    // scene always has SOME lightning visible.
    const schedule = () => {
      this.time.delayedCall(Phaser.Math.Between(220, 700), () => {
        if (!this.isAlive) return
        strike()
        schedule()
      })
    }
    strike()
    schedule()
  }

  private createGridLines(W: number, worldH: number) {
    // Extend grid 2000px beyond world so zooming out never shows raw black.
    // Two-tone grid: a soft base + brighter accent every 5th line for depth,
    // sitting above the nebula but below units.
    const PAD  = 2000
    const step = 40
    const grid = this.add.graphics().setDepth(-70)
    grid.lineStyle(1, 0x00e5ff, 0.045)
    for (let x = -PAD; x < W + PAD; x += step) grid.lineBetween(x, -PAD, x, worldH + PAD)
    for (let y = -PAD; y < worldH + PAD; y += step) grid.lineBetween(-PAD, y, W + PAD, y)
    // Accent grid — every 200px, slightly brighter, gives a "surface" feel.
    grid.lineStyle(1, 0x00e5ff, 0.16)
    for (let x = -PAD; x < W + PAD; x += step * 5) grid.lineBetween(x, -PAD, x, worldH + PAD)
    for (let y = -PAD; y < worldH + PAD; y += step * 5) grid.lineBetween(-PAD, y, W + PAD, y)
  }

  private createParticles() {
    this.emitter = this.add.particles(0, 0, 'coin_particle', {
      speed: { min: 60, max: 120 }, scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 }, lifespan: 600, quantity: 6, emitting: false,
    })
  }

  // ─── Camera pan/zoom controls ────────────────────────────────────────────
  private setupCameraControls(W: number, worldH: number) {
    const cam = this.cameras.main
    cam.setBounds(0, 0, W, worldH)

    let lastPinchDist = 0

    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      // Pinch zoom (2 touch points)
      const ptrs = (this.input.manager.pointers as Phaser.Input.Pointer[]).filter(p => p.isDown)
      if (ptrs.length >= 2) {
        const dist = Phaser.Math.Distance.Between(ptrs[0].x, ptrs[0].y, ptrs[1].x, ptrs[1].y)
        if (lastPinchDist > 0) {
          const scale = dist / lastPinchDist
          cam.zoom = Phaser.Math.Clamp(cam.zoom * scale, 0.2, 3.0)
          document.dispatchEvent(new CustomEvent('farm-zoom-changed', { detail: { zoom: cam.zoom } }))
        }
        lastPinchDist = dist
        return
      }
      lastPinchDist = 0

      // Single-pointer pan (skip if dragging a unit)
      if (!ptr.isDown || this.isDraggingUnit) return
      cam.scrollX -= ptr.velocity.x / cam.zoom
      cam.scrollY -= ptr.velocity.y / cam.zoom
    })

    this.input.on('pointerup', () => { lastPinchDist = 0 })

    // Central zoom setter — applies clamp and broadcasts zoom level to React
    const setZoom = (z: number) => {
      cam.zoom = Phaser.Math.Clamp(z, 0.2, 3.0)
      document.dispatchEvent(new CustomEvent('farm-zoom-changed', { detail: { zoom: cam.zoom } }))
    }

    // Desktop wheel: scroll = pan, Ctrl+scroll = zoom
    const canvas = this.sys.canvas
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
        const factor = e.deltaY > 0 ? 0.91 : 1.10
        setZoom(cam.zoom * factor)
      } else {
        cam.scrollY += e.deltaY / cam.zoom
        if (e.deltaX) cam.scrollX += e.deltaX / cam.zoom
      }
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })

    // React zoom buttons bridge
    const onZoom = (e: Event) => {
      const { delta } = (e as CustomEvent<{ delta: number }>).detail
      setZoom(cam.zoom + delta)
    }
    canvas.addEventListener('farm-zoom', onZoom)

    // React reset-view button bridge
    const onReset = () => {
      setZoom(1.0)
      cam.scrollX = 0
      cam.scrollY = 0
    }
    canvas.addEventListener('farm-reset-view', onReset)

    // Reset all unit positions to default grid layout
    const onResetPositions = () => {
      const { drones, turrets } = useGameStore.getState()

      // Move drones back to default grid (drone zone)
      drones.forEach((drone, i) => {
        const sprite = this.droneSprites.get(drone.id)
        if (!sprite) return
        const pos = this.defaultDronePos(i, drones.length)
        this.tweens.killTweensOf(sprite)
        sprite.setPosition(pos.x, pos.y)
        this.tweens.add({
          targets: sprite, y: pos.y - 14,
          duration: 1400 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        })
        this.levelLabels.get(drone.id)?.setPosition(pos.x, pos.y + 48)
        const bl = this.brokenLabels.get(drone.id)
        if (bl) bl.setPosition(pos.x, pos.y - 52)
      })

      // Move turrets back to default grid (defense zone)
      turrets.forEach((turret, i) => {
        const sprite = this.turretSprites.get(turret.id)
        if (!sprite) return
        const pos = this.defaultTurretPos(i, turrets.length, drones.length)
        sprite.setPosition(pos.x, pos.y)
        this.levelLabels.get(turret.id)?.setPosition(pos.x, pos.y + 48)
      })

      // Reset camera view and save
      setZoom(1.0)
      cam.scrollX = 0
      cam.scrollY = 0
      this.savePositions()
    }
    canvas.addEventListener('farm-reset-positions', onResetPositions)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('farm-zoom', onZoom)
      canvas.removeEventListener('farm-reset-view', onReset)
      canvas.removeEventListener('farm-reset-positions', onResetPositions)
    })
  }

  // ─── Spawn drones ─────────────────────────────────────────────────────────
  private spawnInitialDrones() {
    const { drones } = useGameStore.getState()
    const saved = this.loadPositions()
    drones.forEach((drone, i) => {
      // Priority: API position (positionX/Y) → localStorage → default grid
      const apiPos = (drone.positionX && drone.positionX > 0 && drone.positionY && drone.positionY > 0)
        ? { x: drone.positionX, y: drone.positionY }
        : null
      const pos = apiPos ?? saved[drone.id] ?? this.defaultDronePos(i, drones.length)
      this.addDroneSprite(drone, pos.x, pos.y)
    })
  }

  private defaultDronePos(idx: number, total: number): { x: number, y: number } {
    const W = this.scale.width
    const cols = Math.min(total, GRID_COLS)
    const cellW = W / (cols + 1)
    return {
      x: (idx % cols + 1) * cellW,
      y: DRONE_START_Y + Math.floor(idx / cols) * DRONE_CELL + DRONE_CELL / 2,
    }
  }

  private addDroneSprite(drone: Drone, x: number, y: number) {
    const tex = getDroneTextureName(drone.droneType, drone.isBroken)
    // Faux 3D perspective: squash Y so the drone reads as if viewed from
    // slightly above (arms/props feel foreshortened, body looks like a hull
    // instead of a flat sticker). Kept subtle so hitbox still matches.
    const sprite = this.add.image(x, y, tex).setScale(0.88, 0.68).setDepth(5)
    sprite.setInteractive({ useHandCursor: true, draggable: true })
    sprite.setData('objectId', drone.id)
    sprite.setData('kind', 'drone')
    this.droneSprites.set(drone.id, sprite)

    sprite.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this.onDroneTap(sprite, drone.id, ptr.worldX, ptr.worldY)
    })

    const tween = this.tweens.add({
      targets: sprite, y: y - 14,
      duration: 1400 + this.droneSprites.size * 200,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
    this.hoverTweens.set(drone.id, tween)

    const lvlLabel = this.add.text(x, y + 48, `LVL ${drone.level}`, {
      fontSize: '10px', fontFamily: 'monospace', color: '#00e5ff',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(6)
    this.levelLabels.set(drone.id, lvlLabel)

    if (drone.isBroken) this.addBrokenLabel(drone.id, sprite)
  }

  private addBrokenLabel(id: string, sprite: Phaser.GameObjects.Image) {
    const label = this.add.text(sprite.x, sprite.y - 52, `🔧 ${i18n.t('farm.repair')}`, {
      fontSize: '12px', fontFamily: 'monospace', color: '#ffaa44',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(6)
    this.brokenLabels.set(id, label)
    this.startSmoke(id, sprite)
  }

  private startSmoke(id: string, sprite: Phaser.GameObjects.Image) {
    if (this.smokeTimers.has(id)) return

    // ── Smoke puffs — rise upward in a column ────────────────────────────
    const smokeTick = this.time.addEvent({
      delay: 260,
      loop: true,
      callback: () => {
        if (!sprite.scene) return
        const r1 = 8 + Math.random() * 6
        const r2 = 6 + Math.random() * 5
        const r3 = 5 + Math.random() * 4
        const ox = (Math.random() - 0.5) * 10
        // Position the Graphics object at sprite position, draw at local (0,0)
        const g = this.add.graphics()
          .setPosition(sprite.x + ox, sprite.y - 18)
          .setDepth(8)
        // Fluffy cloud: three overlapping circles
        g.fillStyle(0x777777, 0.55); g.fillCircle(0,           0,      r1)
        g.fillStyle(0x999999, 0.40); g.fillCircle(r1 * 0.55,  -3,      r2)
        g.fillStyle(0x666666, 0.35); g.fillCircle(-r1 * 0.45, -2,      r3)
        g.fillStyle(0x444444, 0.25); g.fillCircle(0,           3,  r1 * 0.5)
        this.tweens.add({
          targets: g,
          y:      sprite.y - 18 - (55 + Math.random() * 35), // rise up
          x:      sprite.x + ox + (Math.random() - 0.5) * 16,
          scaleX: 2.6, scaleY: 2.6,
          alpha:  0,
          duration: 1800 + Math.random() * 600,
          ease:   'Sine.easeOut',
          onComplete: () => g.destroy(),
        })
      },
    })

    // ── Electric sparks (short-circuit) ─────────────────────────────────
    const sparkTick = this.time.addEvent({
      delay: 160,
      loop: true,
      callback: () => {
        if (!sprite.scene) return
        const bolt = this.add.graphics().setDepth(9)
        const cx = sprite.x, cy = sprite.y
        // Draw 2–3 random zigzag segments
        const segs = 2 + Math.floor(Math.random() * 2)
        const angle = Math.random() * Math.PI * 2
        const len = 14 + Math.random() * 10
        bolt.lineStyle(1.5, 0xffee22, 0.9)
        bolt.beginPath()
        bolt.moveTo(cx, cy)
        for (let i = 1; i <= segs; i++) {
          const t = i / segs
          const jx = (Math.random() - 0.5) * 10
          const jy = (Math.random() - 0.5) * 10
          bolt.lineTo(
            cx + Math.cos(angle) * len * t + jx,
            cy + Math.sin(angle) * len * t + jy,
          )
        }
        bolt.strokePath()
        // Bright tip
        bolt.fillStyle(0xffffff, 1)
        bolt.fillCircle(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len, 2)
        this.tweens.add({
          targets: bolt, alpha: 0,
          duration: 120,
          onComplete: () => bolt.destroy(),
        })

        // Occasional full-body flicker of the sprite
        if (Math.random() < 0.3) {
          this.tweens.add({
            targets: sprite, alpha: 0.35,
            duration: 55, yoyo: true, ease: 'Linear',
          })
        }
      },
    })

    // Store both timers under the same id using a composite key
    this.smokeTimers.set(id, smokeTick)
    this.smokeTimers.set(id + '_spark', sparkTick)
  }

  private stopSmoke(id: string) {
    this.smokeTimers.get(id)?.destroy()
    this.smokeTimers.delete(id)
    this.smokeTimers.get(id + '_spark')?.destroy()
    this.smokeTimers.delete(id + '_spark')
    // Restore sprite alpha in case it was mid-flicker
    const sprite = this.droneSprites.get(id)
    if (sprite?.scene) sprite.setAlpha(1)
  }

  // ─── Spawn turrets ─────────────────────────────────────────────────────────
  private spawnInitialTurrets() {
    const { turrets, drones } = useGameStore.getState()
    const saved = this.loadPositions()
    turrets.forEach((turret, i) => {
      const apiPos = (turret.positionX && turret.positionX > 0 && turret.positionY && turret.positionY > 0)
        ? { x: turret.positionX, y: turret.positionY }
        : null
      const pos = apiPos ?? saved[turret.id] ?? this.defaultTurretPos(i, turrets.length, drones.length)
      this.addTurretSprite(turret, pos.x, pos.y)
    })
  }

  private defaultTurretPos(idx: number, total: number, droneCount: number): { x: number, y: number } {
    const W = this.scale.width
    const sepY = this.separatorY(droneCount)
    const cols = Math.min(Math.max(total, 1), GRID_COLS)
    const cellW = W / (cols + 1)
    return {
      x: (idx % cols + 1) * cellW,
      y: sepY + 60 + Math.floor(idx / cols) * TURRET_CELL + TURRET_CELL / 2,
    }
  }

  private addTurretSprite(turret: Turret, x: number, y: number) {
    const tex = getFarmTurretTextureName(turret.level)
    const sprite = this.add.image(x, y, tex).setScale(0.65).setDepth(5)
    sprite.setInteractive({ useHandCursor: true, draggable: true })
    sprite.setData('objectId', turret.id)
    sprite.setData('kind', 'turret')
    this.turretSprites.set(turret.id, sprite)

    const lbl = this.add.text(x, y + 50, `DEF LV${turret.level}`, {
      fontSize: '10px', fontFamily: 'monospace', color: '#00cc44',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(6)
    this.turretLabels.set(turret.id, lbl)
  }

  // ─── Drag setup ───────────────────────────────────────────────────────────
  private setupDrag() {
    const W = () => this.scale.width

    this.input.on('dragstart', (_ptr: Phaser.Input.Pointer, obj: Phaser.GameObjects.Image) => {
      this.isDraggingUnit = true
      const id = obj.getData('objectId') as string
      this.hoverTweens.get(id)?.pause()
      obj.setDepth(20)
    })

    this.input.on('drag', (_ptr: Phaser.Input.Pointer, obj: Phaser.GameObjects.Image, dx: number, dy: number) => {
      obj.x = Phaser.Math.Clamp(dx, 36, W() - 36)
      obj.y = Phaser.Math.Clamp(dy, 36, this.worldH - 36)
      this.syncLabelsToSprites()
    })

    this.input.on('dragend', (_ptr: Phaser.Input.Pointer, obj: Phaser.GameObjects.Image) => {
      this.isDraggingUnit = false
      const id   = obj.getData('objectId') as string
      const kind = obj.getData('kind') as string
      obj.setDepth(5)

      if (kind === 'drone') {
        this.hoverTweens.get(id)?.stop()
        const tween = this.tweens.add({
          targets: obj, y: obj.y - 14,
          duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        })
        this.hoverTweens.set(id, tween)
      }

      this.savePositions()
    })
  }

  // ─── Label sync ───────────────────────────────────────────────────────────
  private syncLabelsToSprites() {
    this.droneSprites.forEach((sprite, id) => {
      const lvl = this.levelLabels.get(id)
      if (lvl) { lvl.x = sprite.x; lvl.y = sprite.y + 48 }
      const brk = this.brokenLabels.get(id)
      if (brk) { brk.x = sprite.x; brk.y = sprite.y - 52 }
    })
    this.turretSprites.forEach((sprite, id) => {
      const lbl = this.turretLabels.get(id)
      if (lbl) { lbl.x = sprite.x; lbl.y = sprite.y + 50 }
    })
  }

  // ─── Tap ─────────────────────────────────────────────────────────────────
  private onDroneTap(sprite: Phaser.GameObjects.Image, id: string, wx: number, wy: number) {
    const store = useGameStore.getState()
    const drone = store.drones.find((d) => d.id === id)
    if (drone?.isBroken) {
      store.setScreen('shop')
      return
    }
    if (store.energy <= 0) {
      this.spawnFloatingText(wx, wy, i18n.t('farm.noEnergy'), '#ff6666')
      return
    }
    const maxLevel = Math.max(...store.drones.map((d) => d.level))
    const bonus = DRONE_UPGRADES[maxLevel - 1].tapBonus
    store.tap()
    soundManager.tap()
    soundManager.coin()
    this.emitter.setPosition(wx, wy)
    this.emitter.explode(6)

    this.tweens.add({
      targets: sprite, scaleX: 0.86, scaleY: 0.58,
      duration: 65, ease: 'Power2.Out',
      onComplete: () => {
        if (!sprite.scene) return
        this.tweens.add({ targets: sprite, scaleX: 0.78, scaleY: 0.78, duration: 130, ease: 'Back.Out' })
      },
    })

    this.spawnFloatingText(wx, wy - 20, `+${bonus.toFixed(1)}`, '#ffd700')
  }

  private spawnFloatingText(x: number, y: number, msg: string, color: string) {
    const t = this.add.text(x, y, msg, {
      fontSize: '18px', fontFamily: 'monospace', color,
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10)
    this.floatingTexts.push({ text: t, vy: -1.5, life: 60 })
  }

  // ─── Store sync ───────────────────────────────────────────────────────────
  private syncDrones(drones: Drone[]) {
    if (!this.isAlive) return
    drones.forEach((drone) => {
      if (!this.droneSprites.has(drone.id)) {
        const saved = this.loadPositions()
        const total = this.droneSprites.size
        const pos = saved[drone.id] ?? this.defaultDronePos(total, total + 1)
        this.addDroneSprite(drone, pos.x, pos.y)
      }
    })

    drones.forEach((drone) => {
      const sprite = this.droneSprites.get(drone.id)
      if (!sprite || !sprite.scene) return
      const expectedTex = getDroneTextureName(drone.droneType, drone.isBroken)
      if (sprite.texture.key !== expectedTex) sprite.setTexture(expectedTex)

      const hasLabel = this.brokenLabels.has(drone.id)
      if (drone.isBroken && !hasLabel) {
        this.addBrokenLabel(drone.id, sprite)
      } else if (!drone.isBroken && hasLabel) {
        this.brokenLabels.get(drone.id)?.destroy()
        this.brokenLabels.delete(drone.id)
        this.stopSmoke(drone.id)
      }

      const lvlLabel = this.levelLabels.get(drone.id)
      if (lvlLabel) lvlLabel.setText(`LVL ${drone.level}`)
    })

    this.syncLabelsToSprites()
  }

  // ─── Passive income floats ─────────────────────────────────────────────────
  private tickPassiveFloats() {
    if (!this.isAlive) return
    const { drones } = useGameStore.getState()
    drones.forEach((drone) => {
      if (drone.isBroken) return
      const sprite = this.droneSprites.get(drone.id)
      if (!sprite || !sprite.scene) return
      const perSecond = drone.incomePerSec
      this.spawnPassiveFloat(sprite.x, sprite.y, this.formatPassive(perSecond))
    })
  }

  private spawnPassiveFloat(x: number, y: number, label: string) {
    const startY = y - 52, midY = y - 88, endY = y - 112
    const t = this.add.text(x, startY, label, {
      fontSize: '13px', fontFamily: 'monospace', color: '#66ffbb',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(8).setAlpha(0)

    this.tweens.add({
      targets: t, y: midY, alpha: 0.90, duration: 350, ease: 'Power1.Out',
      onComplete: () => {
        this.tweens.add({
          targets: t, y: endY, alpha: 0, duration: 550, delay: 100, ease: 'Power1.In',
          onComplete: () => { if (t.scene) t.destroy() },
        })
      },
    })
  }

  private formatPassive(v: number): string {
    if (v >= 100) return `+${v.toFixed(0)}`
    if (v >= 10)  return `+${v.toFixed(1)}`
    if (v >= 1)   return `+${v.toFixed(2)}`
    if (v >= 0.1) return `+${v.toFixed(3)}`
    return `+${v.toFixed(4)}`
  }

  // ─── localStorage ──────────────────────────────────────────────────────────
  private loadPositions(): Record<string, { x: number, y: number }> {
    try { return JSON.parse(localStorage.getItem(POSITIONS_KEY) || '{}') }
    catch { return {} }
  }

  private _syncTimer: ReturnType<typeof setTimeout> | null = null

  private savePositions() {
    const dronePos:  Array<{ id: number; position_x: number; position_y: number }> = []
    const turretPos: Array<{ id: number; position_x: number; position_y: number }> = []
    const localStorage_pos: Record<string, { x: number, y: number }> = {}

    this.droneSprites.forEach((s, id) => {
      const x = Math.round(s.x), y = Math.round(s.y)
      localStorage_pos[id] = { x, y }
      dronePos.push({ id: Number(id), position_x: x, position_y: y })
    })
    this.turretSprites.forEach((s, id) => {
      const x = Math.round(s.x), y = Math.round(s.y)
      localStorage_pos[id] = { x, y }
      turretPos.push({ id: Number(id), position_x: x, position_y: y })
    })

    // Save to localStorage immediately (instant, offline-friendly)
    try { localStorage.setItem(POSITIONS_KEY, JSON.stringify(localStorage_pos)) } catch { /* quota */ }

    // Debounce API sync: wait 1.5s after last drag before sending network request.
    // Prevents 429 when user repositions multiple units in quick succession.
    if (this._syncTimer) clearTimeout(this._syncTimer)
    this._syncTimer = setTimeout(() => {
      this._syncTimer = null
      apiSyncPositions(dronePos, turretPos).catch(() => {/* silent — positions are cosmetic */})
    }, 1500)
  }

  // ─── Update ───────────────────────────────────────────────────────────────
  update() {
    this.floatingTexts = this.floatingTexts.filter((ft) => {
      ft.text.y += ft.vy
      ft.text.alpha -= 1 / 60
      ft.life--
      if (ft.life <= 0) { ft.text.destroy(); return false }
      return true
    })
  }
}
