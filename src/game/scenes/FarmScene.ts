import Phaser from 'phaser'
import i18n from '../../i18n'
import { useGameStore, DRONE_UPGRADES, type Drone, type Turret, type DroneType } from '../../store/gameStore'
import { getDroneTextureName, getFarmTurretTextureName } from '../utils/droneGraphics'
import { soundManager } from '../utils/soundManager'

interface FloatingText { text: Phaser.GameObjects.Text; vy: number; life: number }

// Farm-scene units are grouped by (type × level). Each bucket becomes a single
// sprite with a "×N" badge — indispensable when a player owns hundreds of drones,
// because the previous "one sprite per unit" strategy hit ~300 sprites +
// ~300 Text objects created/destroyed every second and locked mid-tier phones.
// The badge counts are visual only; upgrades, sales, and detail views still
// operate on individual DB units via the Equipment screen.
interface DroneBucket {
  key:       string      // "d:1:1"
  droneType: DroneType
  level:     number
  members:   Drone[]     // healthy drones only
}
interface BrokenBucket {
  count:      number
  sampleType: DroneType   // texture picker — first broken drone's type
}
interface TurretBucket {
  key:     string          // "t:1"
  level:   number
  members: Turret[]
}

const BROKEN_KEY = 'broken'

const GRID_COLS   = 3
const DRONE_CELL  = 200
const TURRET_CELL = 200
const POSITIONS_KEY = 'cyber-farm-positions'
const DRONE_START_Y = 80   // world Y where drones begin

const droneBucketKey  = (d: Drone):  string => `d:${d.droneType}:${d.level}`
const turretBucketKey = (t: Turret): string => `t:${t.level}`

export class FarmScene extends Phaser.Scene {
  private droneBuckets:      Map<string, DroneBucket>            = new Map()
  private brokenBucket:      BrokenBucket | null                 = null
  private turretBuckets:     Map<string, TurretBucket>           = new Map()
  private droneSprites:      Map<string, Phaser.GameObjects.Image> = new Map()
  private turretSprites:     Map<string, Phaser.GameObjects.Image> = new Map()
  private levelLabels:       Map<string, Phaser.GameObjects.Text>  = new Map()
  private turretLabels:      Map<string, Phaser.GameObjects.Text>  = new Map()
  private brokenWrenchBadge: Phaser.GameObjects.Text | null       = null
  private hoverTweens:       Map<string, Phaser.Tweens.Tween>      = new Map()
  private smokeTimers:       Map<string, Phaser.Time.TimerEvent>   = new Map()
  private floatingTexts:     FloatingText[] = []
  private emitter!:          Phaser.GameObjects.Particles.ParticleEmitter
  private unsubscribeStore?: () => void
  private isAlive         = false
  private isDraggingUnit  = false
  private worldH          = 2000

  constructor() { super({ key: 'FarmScene' }) }

  create() {
    const { width: W, height: H } = this.scale
    const { drones, turrets } = useGameStore.getState()

    this.rebuildBuckets(drones, turrets)
    // Broken bucket is a fixed screen overlay, NOT part of the drone grid —
    // it doesn't consume a slot so healthy buckets keep their natural layout.
    const droneBucketCount  = this.droneBuckets.size
    const turretBucketCount = this.turretBuckets.size

    this.worldH = this.calcWorldH(H, droneBucketCount, turretBucketCount)

    this.drawBackground(W, this.worldH, droneBucketCount)
    this.createMatrixSphere(W, this.worldH)
    this.createParticles()
    this.spawnDroneBucketSprites()
    this.spawnTurretBucketSprites()
    this.setupDrag()
    this.setupCameraControls(W, this.worldH)

    this.isAlive = true
    this.unsubscribeStore = useGameStore.subscribe((state) => {
      this.syncFromStore(state.drones, state.turrets)
    })

    // Keep the fixed-screen broken sprite pinned to the viewport corner when
    // the game canvas resizes (device orientation, TMA layout shift, etc.).
    this.scale.on('resize', this.repositionBrokenSprite, this)

    // Passive income floats — every second, aggregated per bucket.
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
      this.droneSprites.forEach((s) => { if (s.scene) s.setAlpha(1) })
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup)
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup)
  }

  // ─── Bucket construction ─────────────────────────────────────────────────
  // Healthy drones are grouped by (type × level). ALL broken drones — no
  // matter their type or level — collapse into a single "broken" bucket
  // that acts as a shortcut to the shop's repair section.
  private rebuildBuckets(drones: Drone[], turrets: Turret[]) {
    this.droneBuckets.clear()
    let brokenCount = 0
    let brokenSampleType: DroneType | null = null
    for (const d of drones) {
      if (d.isBroken) {
        brokenCount++
        if (brokenSampleType == null) brokenSampleType = d.droneType
        continue
      }
      const key = droneBucketKey(d)
      let bucket = this.droneBuckets.get(key)
      if (!bucket) {
        bucket = { key, droneType: d.droneType, level: d.level, members: [] }
        this.droneBuckets.set(key, bucket)
      }
      bucket.members.push(d)
    }
    this.brokenBucket = brokenCount > 0 && brokenSampleType != null
      ? { count: brokenCount, sampleType: brokenSampleType }
      : null

    this.turretBuckets.clear()
    for (const t of turrets) {
      const key = turretBucketKey(t)
      let bucket = this.turretBuckets.get(key)
      if (!bucket) {
        bucket = { key, level: t.level, members: [] }
        this.turretBuckets.set(key, bucket)
      }
      bucket.members.push(t)
    }
  }

  // ─── World height calculation (bucket-based, not per-unit) ───────────────
  private calcWorldH(H: number, droneBuckets: number, turretBuckets: number): number {
    const dc = Math.max(droneBuckets, 1)
    const tc = Math.max(turretBuckets, 0)
    const droneRows  = Math.ceil(dc / GRID_COLS)
    const turretRows = Math.ceil(tc / GRID_COLS)
    const droneZoneH  = DRONE_START_Y + droneRows * DRONE_CELL
    const separatorH  = 60
    const turretZoneH = tc > 0 ? separatorH + turretRows * TURRET_CELL + 60 : 80
    return Math.max(H * 2.2, droneZoneH + turretZoneH)
  }

  private separatorY(droneBuckets: number): number {
    const rows = Math.ceil(Math.max(droneBuckets, 1) / GRID_COLS)
    return DRONE_START_Y + rows * DRONE_CELL + 177
  }

  private drawBackground(W: number, worldH: number, droneBucketCount: number) {
    const sepY = this.separatorY(droneBucketCount)
    const PAD  = 2000

    const bg = this.add.graphics().setDepth(-100)
    bg.fillStyle(0x02040a, 1)
    bg.fillRect(-PAD, -PAD, W + PAD * 2, worldH + PAD * 2)

    bg.fillStyle(0x061a2a, 0.55)
    bg.fillRect(-PAD, -PAD, W + PAD * 2, sepY + PAD)
    bg.fillStyle(0x061a10, 0.55)
    bg.fillRect(-PAD, sepY, W + PAD * 2, worldH - sepY + PAD)

    bg.lineStyle(6, 0x00ff88, 0.08)
    bg.lineBetween(-PAD, sepY, W + PAD, sepY)
    bg.lineStyle(2, 0x00ff88, 0.35)
    bg.lineBetween(-PAD, sepY, W + PAD, sepY)

    this.add.text(10, 68, 'DRONE ZONE', {
      fontSize: '9px', fontFamily: 'monospace', color: '#00ff88',
    }).setAlpha(0.35).setDepth(-1)
    this.add.text(10, sepY + 8, 'DEFENSE ZONE', {
      fontSize: '9px', fontFamily: 'monospace', color: '#00cc44',
    }).setAlpha(0.35).setDepth(-1)
  }

  private createMatrixSphere(W: number, _worldH: number) {
    const H = this.scale.height
    const cx = W / 2
    const cy = H / 2
    const R  = Math.max(W, H) * 0.62

    const rim = this.add.graphics().setDepth(-88).setScrollFactor(0)
    rim.lineStyle(8, 0x00ff88, 0.06);  rim.strokeCircle(cx, cy, R * 1.02)
    rim.lineStyle(4, 0x00ff88, 0.20);  rim.strokeCircle(cx, cy, R * 1.00)
    rim.lineStyle(2, 0x66ffaa, 0.80);  rim.strokeCircle(cx, cy, R * 0.98)
    rim.lineStyle(2, 0xffffff, 0.14)
    rim.beginPath()
    rim.arc(cx, cy, R * 0.94, Math.PI * 1.15, Math.PI * 1.55, false)
    rim.strokePath()
    this.tweens.add({
      targets: rim,
      alpha: { from: 0.7, to: 1 },
      duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })

    const CHARS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉ0123456789ABCDEF#$%&＊+ﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓ'.split('')
    const rand = () => CHARS[Math.floor(Math.random() * CHARS.length)]

    interface RainTile {
      text: Phaser.GameObjects.Text
      baseAlpha: number
    }
    interface Column { tiles: RainTile[]; speed: number; colX: number; len: number }
    const columns: Column[] = []

    const COL_WIDTH = 18
    const nCols = Math.ceil(W / COL_WIDTH) + 2

    for (let ci = 0; ci < nCols; ci++) {
      const colX = ci * COL_WIDTH
      if (Math.abs(colX - cx) > R * 1.05) continue

      const columnLen = 12 + Math.floor(Math.random() * 6)
      const speed = 34 + Math.random() * 55

      const tiles: RainTile[] = []
      for (let ri = 0; ri < columnLen; ri++) {
        const isHead = ri === columnLen - 1
        const t = this.add.text(colX, ri * 20, rand(), {
          fontSize: '14px',
          fontFamily: 'monospace',
          color: isHead ? '#e6ffe0' : '#00cc44',
        }).setDepth(-89).setScrollFactor(0)
        const baseAlpha = isHead ? 1 : Math.max(0.15, ri / columnLen * 0.9)
        t.setAlpha(baseAlpha)
        tiles.push({ text: t, baseAlpha })
      }

      const startOffset = -Math.random() * H
      for (const tile of tiles) tile.text.y += startOffset

      columns.push({ tiles, speed, colX, len: columnLen })
    }

    this.events.on(Phaser.Scenes.Events.PRE_UPDATE, (_time: number, deltaMs: number) => {
      const dt = deltaMs / 1000
      for (const col of columns) {
        const dy = col.speed * dt
        for (const tile of col.tiles) {
          tile.text.y += dy
          if (tile.text.y > H + 20) {
            tile.text.y -= (col.len + 2) * 20 + Math.random() * 60
          }
          const dx = tile.text.x - cx
          const dy2 = tile.text.y - cy
          const d  = Math.hypot(dx, dy2)
          const fade = d < R * 0.75
            ? 1
            : d < R
              ? 1 - (d - R * 0.75) / (R * 0.25)
              : 0
          tile.text.setAlpha(tile.baseAlpha * fade)
        }
        if (Math.random() < 0.04) {
          const idx = Math.floor(Math.random() * col.tiles.length)
          col.tiles[idx].text.setText(rand())
        }
      }
    })
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

      if (!ptr.isDown || this.isDraggingUnit) return
      cam.scrollX -= ptr.velocity.x / cam.zoom
      cam.scrollY -= ptr.velocity.y / cam.zoom
    })

    this.input.on('pointerup', () => { lastPinchDist = 0 })

    const setZoom = (z: number) => {
      cam.zoom = Phaser.Math.Clamp(z, 0.2, 3.0)
      document.dispatchEvent(new CustomEvent('farm-zoom-changed', { detail: { zoom: cam.zoom } }))
    }

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

    const onZoom = (e: Event) => {
      const { delta } = (e as CustomEvent<{ delta: number }>).detail
      setZoom(cam.zoom + delta)
    }
    canvas.addEventListener('farm-zoom', onZoom)

    const onReset = () => {
      setZoom(1.0)
      cam.scrollX = 0
      cam.scrollY = 0
    }
    canvas.addEventListener('farm-reset-view', onReset)

    const onResetPositions = () => {
      const droneKeys  = Array.from(this.droneBuckets.keys())
      const turretKeys = Array.from(this.turretBuckets.keys())

      droneKeys.forEach((key, i) => {
        const sprite = this.droneSprites.get(key)
        if (!sprite) return
        const pos = this.defaultDronePos(i, droneKeys.length)
        this.tweens.killTweensOf(sprite)
        sprite.setPosition(pos.x, pos.y)
        this.tweens.add({
          targets: sprite, y: pos.y - 14,
          duration: 1400 + i * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        })
        this.levelLabels.get(key)?.setPosition(pos.x, pos.y + 48)
      })
      // Broken sprite stays where it is — it's a fixed-screen UI element,
      // not a grid tile, so "reset positions" doesn't move it.

      turretKeys.forEach((key, i) => {
        const sprite = this.turretSprites.get(key)
        if (!sprite) return
        const pos = this.defaultTurretPos(i, turretKeys.length, droneKeys.length)
        sprite.setPosition(pos.x, pos.y)
        this.turretLabels.get(key)?.setPosition(pos.x, pos.y + 50)
      })

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

  // ─── Spawn drone bucket sprites (1 per (type, level) group) ─────────────
  private spawnDroneBucketSprites() {
    const saved = this.loadPositions()
    const keys  = Array.from(this.droneBuckets.keys())
    keys.forEach((key, i) => {
      const bucket = this.droneBuckets.get(key)!
      const pos = saved[key] ?? this.defaultDronePos(i, keys.length)
      this.addDroneBucketSprite(bucket, pos.x, pos.y)
    })
    // Broken bucket lives on the camera (fixed screen overlay), not in the grid.
    if (this.brokenBucket) this.addBrokenBucketSprite(this.brokenBucket)
  }

  // Screen-space anchor for the broken sprite: bottom-right, safely above the
  // camera-zoom control column at the right edge (which occupies the last
  // ~150px). Attached to the camera so it stays put when the player pans/zooms.
  private brokenScreenPos(): { x: number; y: number } {
    return { x: this.scale.width - 42, y: this.scale.height - 240 }
  }

  private repositionBrokenSprite() {
    const sprite = this.droneSprites.get(BROKEN_KEY)
    if (!sprite || !sprite.scene) return
    const { x, y } = this.brokenScreenPos()
    sprite.setPosition(x, y)
    this.levelLabels.get(BROKEN_KEY)?.setPosition(x, y + 22)
    this.brokenWrenchBadge?.setPosition(x + 14, y - 14)
  }

  private defaultDronePos(idx: number, total: number): { x: number, y: number } {
    const W = this.scale.width
    const cols = Math.min(Math.max(total, 1), GRID_COLS)
    const cellW = W / (cols + 1)
    return {
      x: (idx % cols + 1) * cellW,
      y: DRONE_START_Y + Math.floor(idx / cols) * DRONE_CELL + DRONE_CELL / 2,
    }
  }

  private addDroneBucketSprite(bucket: DroneBucket, x: number, y: number) {
    const tex = getDroneTextureName(bucket.droneType, false)
    const sprite = this.add.image(x, y, tex).setScale(0.85).setDepth(5)
    sprite.setInteractive({ useHandCursor: true, draggable: true })
    sprite.setData('bucketKey', bucket.key)
    sprite.setData('kind', 'drone')
    this.droneSprites.set(bucket.key, sprite)

    sprite.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this.onDroneBucketTap(sprite, bucket.key, ptr.worldX, ptr.worldY)
    })

    const tween = this.tweens.add({
      targets: sprite, y: y - 14,
      duration: 1400 + this.droneSprites.size * 200,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
    this.hoverTweens.set(bucket.key, tween)

    const lvlLabel = this.add.text(x, y + 48, this.droneLabelText(bucket), {
      fontSize: '10px', fontFamily: 'monospace', color: '#00e5ff',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(6)
    this.levelLabels.set(bucket.key, lvlLabel)
  }

  private droneLabelText(bucket: DroneBucket): string {
    return `LVL ${bucket.level} ×${bucket.members.length}`
  }

  // Broken drones — one aggregated mini-sprite pinned to the camera at the
  // bottom-right of the viewport. Small, wobbles gently, and only carries an
  // "×N" badge underneath. Tap opens the shop's repair section; no drag, no
  // farming animation, no hover tween.
  private addBrokenBucketSprite(bucket: BrokenBucket) {
    const { x, y } = this.brokenScreenPos()
    const tex = getDroneTextureName(bucket.sampleType, true)
    const sprite = this.add.image(x, y, tex)
      .setScale(0.35)
      .setDepth(50)
      .setAlpha(0.95)
      .setScrollFactor(0)
    sprite.setInteractive({ useHandCursor: true })
    sprite.setData('bucketKey', BROKEN_KEY)
    sprite.setData('kind', 'drone')
    this.droneSprites.set(BROKEN_KEY, sprite)

    sprite.on('pointerdown', () => {
      useGameStore.getState().setScreen('shop')
    })

    // Wobble — small side-to-side rotation, cheap and infinite.
    const wobble = this.tweens.add({
      targets: sprite,
      angle: { from: -8, to: 8 },
      duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
    this.hoverTweens.set(BROKEN_KEY, wobble)

    // Count badge under the sprite.
    const label = this.add.text(x, y + 22, `×${bucket.count}`, {
      fontSize: '12px', fontFamily: 'monospace', color: '#ffaa44',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(51).setScrollFactor(0)
    this.levelLabels.set(BROKEN_KEY, label)

    // Wrench badge — small 🔧 pinned to the top-right corner of the sprite so
    // the icon reads as "needs repair" even at a glance.
    this.brokenWrenchBadge = this.add.text(x + 14, y - 14, '🔧', {
      fontSize: '13px', fontFamily: 'monospace', color: '#ffaa44',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(52).setScrollFactor(0)

    // Ambient smoke/spark — pinned to the camera so it stays over the sprite
    // when the player pans the farm.
    this.startFixedSmoke(BROKEN_KEY, sprite)
  }

  private startSmoke(id: string, sprite: Phaser.GameObjects.Image) {
    if (this.smokeTimers.has(id)) return

    const smokeTick = this.time.addEvent({
      delay: 260,
      loop: true,
      callback: () => {
        if (!sprite.scene) return
        const r1 = 8 + Math.random() * 6
        const r2 = 6 + Math.random() * 5
        const r3 = 5 + Math.random() * 4
        const ox = (Math.random() - 0.5) * 10
        const g = this.add.graphics()
          .setPosition(sprite.x + ox, sprite.y - 18)
          .setDepth(8)
        g.fillStyle(0x777777, 0.55); g.fillCircle(0,           0,      r1)
        g.fillStyle(0x999999, 0.40); g.fillCircle(r1 * 0.55,  -3,      r2)
        g.fillStyle(0x666666, 0.35); g.fillCircle(-r1 * 0.45, -2,      r3)
        g.fillStyle(0x444444, 0.25); g.fillCircle(0,           3,  r1 * 0.5)
        this.tweens.add({
          targets: g,
          y:      sprite.y - 18 - (55 + Math.random() * 35),
          x:      sprite.x + ox + (Math.random() - 0.5) * 16,
          scaleX: 2.6, scaleY: 2.6,
          alpha:  0,
          duration: 1800 + Math.random() * 600,
          ease:   'Sine.easeOut',
          onComplete: () => g.destroy(),
        })
      },
    })

    const sparkTick = this.time.addEvent({
      delay: 160,
      loop: true,
      callback: () => {
        if (!sprite.scene) return
        const bolt = this.add.graphics().setDepth(9)
        const cx = sprite.x, cy = sprite.y
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
        bolt.fillStyle(0xffffff, 1)
        bolt.fillCircle(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len, 2)
        this.tweens.add({
          targets: bolt, alpha: 0,
          duration: 120,
          onComplete: () => bolt.destroy(),
        })

        if (Math.random() < 0.3) {
          this.tweens.add({
            targets: sprite, alpha: 0.35,
            duration: 55, yoyo: true, ease: 'Linear',
          })
        }
      },
    })

    this.smokeTimers.set(id, smokeTick)
    this.smokeTimers.set(id + '_spark', sparkTick)
  }

  // Same idea as startSmoke, but every particle sits on the camera
  // (scrollFactor 0) — used for the fixed-UI broken sprite so smoke plumes
  // don't drift off-screen when the player pans the farm.
  private startFixedSmoke(id: string, sprite: Phaser.GameObjects.Image) {
    if (this.smokeTimers.has(id)) return

    const smokeTick = this.time.addEvent({
      delay: 320, loop: true,
      callback: () => {
        if (!sprite.scene) return
        const r1 = 5 + Math.random() * 3
        const r2 = 4 + Math.random() * 3
        const ox = (Math.random() - 0.5) * 6
        const g = this.add.graphics()
          .setPosition(sprite.x + ox, sprite.y - 10)
          .setDepth(49)
          .setScrollFactor(0)
        g.fillStyle(0x777777, 0.5); g.fillCircle(0,        0,      r1)
        g.fillStyle(0x999999, 0.35); g.fillCircle(r1 * 0.5, -2,    r2)
        g.fillStyle(0x555555, 0.30); g.fillCircle(-r1 * 0.4, -1,   r2 * 0.9)
        this.tweens.add({
          targets: g,
          y:      sprite.y - 10 - (30 + Math.random() * 18),
          x:      sprite.x + ox + (Math.random() - 0.5) * 10,
          scaleX: 1.8, scaleY: 1.8,
          alpha:  0,
          duration: 1400 + Math.random() * 500,
          ease:   'Sine.easeOut',
          onComplete: () => g.destroy(),
        })
      },
    })

    const sparkTick = this.time.addEvent({
      delay: 220, loop: true,
      callback: () => {
        if (!sprite.scene) return
        const bolt = this.add.graphics().setDepth(50).setScrollFactor(0)
        const cx = sprite.x, cy = sprite.y
        const angle = Math.random() * Math.PI * 2
        const len = 8 + Math.random() * 6
        bolt.lineStyle(1.2, 0xffee22, 0.85)
        bolt.beginPath()
        bolt.moveTo(cx, cy)
        bolt.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len)
        bolt.strokePath()
        bolt.fillStyle(0xffffff, 1)
        bolt.fillCircle(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len, 1.5)
        this.tweens.add({
          targets: bolt, alpha: 0,
          duration: 120,
          onComplete: () => bolt.destroy(),
        })
      },
    })

    this.smokeTimers.set(id, smokeTick)
    this.smokeTimers.set(id + '_spark', sparkTick)
  }

  private stopSmoke(id: string) {
    this.smokeTimers.get(id)?.destroy()
    this.smokeTimers.delete(id)
    this.smokeTimers.get(id + '_spark')?.destroy()
    this.smokeTimers.delete(id + '_spark')
    const sprite = this.droneSprites.get(id)
    if (sprite?.scene) sprite.setAlpha(1)
  }

  // Tear down all objects owned by a drone bucket (healthy OR broken).
  private destroyDroneSprite(key: string) {
    this.droneSprites.get(key)?.destroy()
    this.droneSprites.delete(key)
    this.levelLabels.get(key)?.destroy()
    this.levelLabels.delete(key)
    this.stopSmoke(key)
    this.hoverTweens.get(key)?.stop()
    this.hoverTweens.delete(key)
    if (key === BROKEN_KEY) {
      this.brokenWrenchBadge?.destroy()
      this.brokenWrenchBadge = null
    }
  }

  // ─── Spawn turret bucket sprites ─────────────────────────────────────────
  private spawnTurretBucketSprites() {
    const saved = this.loadPositions()
    const droneCount = this.droneBuckets.size
    const keys = Array.from(this.turretBuckets.keys())
    keys.forEach((key, i) => {
      const bucket = this.turretBuckets.get(key)!
      const pos = saved[key] ?? this.defaultTurretPos(i, keys.length, droneCount)
      this.addTurretBucketSprite(bucket, pos.x, pos.y)
    })
  }

  private defaultTurretPos(idx: number, total: number, droneBucketCount: number): { x: number, y: number } {
    const W = this.scale.width
    const sepY = this.separatorY(droneBucketCount)
    const cols = Math.min(Math.max(total, 1), GRID_COLS)
    const cellW = W / (cols + 1)
    return {
      x: (idx % cols + 1) * cellW,
      y: sepY + 60 + Math.floor(idx / cols) * TURRET_CELL + TURRET_CELL / 2,
    }
  }

  private addTurretBucketSprite(bucket: TurretBucket, x: number, y: number) {
    const tex = getFarmTurretTextureName(bucket.level)
    const sprite = this.add.image(x, y, tex).setScale(0.65).setDepth(5)
    sprite.setInteractive({ useHandCursor: true, draggable: true })
    sprite.setData('bucketKey', bucket.key)
    sprite.setData('kind', 'turret')
    this.turretSprites.set(bucket.key, sprite)

    const lbl = this.add.text(x, y + 50, `DEF LV${bucket.level} ×${bucket.members.length}`, {
      fontSize: '10px', fontFamily: 'monospace', color: '#00cc44',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(6)
    this.turretLabels.set(bucket.key, lbl)
  }

  // ─── Drag setup ───────────────────────────────────────────────────────────
  private setupDrag() {
    const W = () => this.scale.width

    this.input.on('dragstart', (_ptr: Phaser.Input.Pointer, obj: Phaser.GameObjects.Image) => {
      this.isDraggingUnit = true
      const key = obj.getData('bucketKey') as string
      this.hoverTweens.get(key)?.pause()
      obj.setDepth(20)
    })

    this.input.on('drag', (_ptr: Phaser.Input.Pointer, obj: Phaser.GameObjects.Image, dx: number, dy: number) => {
      obj.x = Phaser.Math.Clamp(dx, 36, W() - 36)
      obj.y = Phaser.Math.Clamp(dy, 36, this.worldH - 36)
      this.syncLabelsToSprites()
    })

    this.input.on('dragend', (_ptr: Phaser.Input.Pointer, obj: Phaser.GameObjects.Image) => {
      this.isDraggingUnit = false
      const key  = obj.getData('bucketKey') as string
      const kind = obj.getData('kind') as string
      obj.setDepth(5)

      // Broken sprite doesn't hover — leave it grounded after drag.
      if (kind === 'drone' && key !== BROKEN_KEY) {
        this.hoverTweens.get(key)?.stop()
        const tween = this.tweens.add({
          targets: obj, y: obj.y - 14,
          duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        })
        this.hoverTweens.set(key, tween)
      }

      this.savePositions()
    })
  }

  // ─── Label sync ───────────────────────────────────────────────────────────
  private syncLabelsToSprites() {
    this.droneSprites.forEach((sprite, key) => {
      // Broken sprite has its own tighter offsets and lives on the camera —
      // don't overwrite them from the grid-drone loop.
      if (key === BROKEN_KEY) return
      const lvl = this.levelLabels.get(key)
      if (lvl) { lvl.x = sprite.x; lvl.y = sprite.y + 48 }
    })
    this.turretSprites.forEach((sprite, key) => {
      const lbl = this.turretLabels.get(key)
      if (lbl) { lbl.x = sprite.x; lbl.y = sprite.y + 50 }
    })
  }

  // ─── Tap on a drone bucket ───────────────────────────────────────────────
  // A single click represents "all healthy drones in the bucket harvesting at once":
  // energy is charged per drone (clamped by available), gold is bonus × healthyCount.
  // Matches the server contract (POST /user/tap accepts a `taps` count in one call).
  private onDroneBucketTap(sprite: Phaser.GameObjects.Image, bucketKey: string, wx: number, wy: number) {
    const store  = useGameStore.getState()
    const bucket = this.droneBuckets.get(bucketKey)
    if (!bucket || bucket.members.length === 0) return

    // Banned players: no farming — show a red "blocked" hint and bail before
    // any tap/sound/particle effect fires. Overlay isn't auto-reopened here
    // (the HUD ⚠ icon is right there if they want to see the timer).
    if (store.bannedUntil != null && store.bannedUntil > Date.now()) {
      this.spawnFloatingText(wx, wy, i18n.t('ban.title'), '#ff6666')
      return
    }

    if (store.energy <= 0) {
      this.spawnFloatingText(wx, wy, i18n.t('farm.noEnergy'), '#ff6666')
      return
    }
    // Group tap needs enough energy for every drone in the bucket. If short,
    // upsell the Battery product — but respect the session-dismiss flag so we
    // don't spam the modal after the user closed it once.
    if (store.energy < bucket.members.length && !store.batteryModalDismissed) {
      store.openBatteryModal()
      return
    }
    // Bucket only contains healthy drones — broken units live in a separate
    // aggregated bucket that opens the shop instead of farming.
    const spend = Math.min(bucket.members.length, store.energy)
    if (spend <= 0) return
    const maxLevel = Math.max(...store.drones.map((d) => d.level))
    const bonusPer = DRONE_UPGRADES[maxLevel - 1].tapBonus
    const totalBonus = bonusPer * spend

    store.tap(spend)
    soundManager.tap()
    soundManager.coin()
    this.emitter.setPosition(wx, wy)
    this.emitter.explode(Math.min(6 + Math.floor(spend / 5), 24))

    this.tweens.add({
      targets: sprite, scaleX: 0.86, scaleY: 0.58,
      duration: 65, ease: 'Power2.Out',
      onComplete: () => {
        if (!sprite.scene) return
        this.tweens.add({ targets: sprite, scaleX: 0.78, scaleY: 0.78, duration: 130, ease: 'Back.Out' })
      },
    })

    this.spawnFloatingText(wx, wy - 20, this.formatTapBonus(totalBonus, spend), '#ffd700')
  }

  private formatTapBonus(total: number, count: number): string {
    // "+0.5" for a single-drone bucket, "+50.0 ×100" for a big harvest.
    if (count <= 1) return `+${total.toFixed(1)}`
    if (total >= 100) return `+${total.toFixed(0)} ×${count}`
    return `+${total.toFixed(1)} ×${count}`
  }

  private spawnFloatingText(x: number, y: number, msg: string, color: string) {
    const t = this.add.text(x, y, msg, {
      fontSize: '18px', fontFamily: 'monospace', color,
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10)
    this.floatingTexts.push({ text: t, vy: -1.5, life: 60 })
  }

  // ─── Store sync — recompute buckets when the drone/turret list changes ──
  private syncFromStore(drones: Drone[], turrets: Turret[]) {
    if (!this.isAlive) return

    const prevDroneKeys  = new Set(this.droneBuckets.keys())
    const prevTurretKeys = new Set(this.turretBuckets.keys())

    this.rebuildBuckets(drones, turrets)

    // Remove sprites for healthy buckets that no longer exist.
    prevDroneKeys.forEach((key) => {
      if (this.droneBuckets.has(key)) return
      this.destroyDroneSprite(key)
    })
    // Remove the broken sprite if there are no broken drones anymore.
    if (!this.brokenBucket && this.droneSprites.has(BROKEN_KEY)) {
      this.destroyDroneSprite(BROKEN_KEY)
    }
    prevTurretKeys.forEach((key) => {
      if (this.turretBuckets.has(key)) return
      this.turretSprites.get(key)?.destroy()
      this.turretSprites.delete(key)
      this.turretLabels.get(key)?.destroy()
      this.turretLabels.delete(key)
    })

    // Add sprites for new healthy buckets, update labels for existing ones.
    const saved = this.loadPositions()
    const droneKeys = Array.from(this.droneBuckets.keys())
    droneKeys.forEach((key, i) => {
      const bucket = this.droneBuckets.get(key)!
      if (!this.droneSprites.has(key)) {
        const pos = saved[key] ?? this.defaultDronePos(i, droneKeys.length)
        this.addDroneBucketSprite(bucket, pos.x, pos.y)
        return
      }
      this.levelLabels.get(key)?.setText(this.droneLabelText(bucket))
    })

    // Broken bucket: create if missing (fixed screen slot), update badge if already there.
    if (this.brokenBucket) {
      if (!this.droneSprites.has(BROKEN_KEY)) {
        this.addBrokenBucketSprite(this.brokenBucket)
      } else {
        this.levelLabels.get(BROKEN_KEY)?.setText(`×${this.brokenBucket.count}`)
      }
    }

    const turretKeys = Array.from(this.turretBuckets.keys())
    turretKeys.forEach((key, i) => {
      const bucket = this.turretBuckets.get(key)!
      if (!this.turretSprites.has(key)) {
        const pos = saved[key] ?? this.defaultTurretPos(i, turretKeys.length, droneKeys.length)
        this.addTurretBucketSprite(bucket, pos.x, pos.y)
        return
      }
      this.turretLabels.get(key)?.setText(`DEF LV${bucket.level} ×${bucket.members.length}`)
    })

    this.syncLabelsToSprites()
  }

  // ─── Passive income floats — one per bucket, summed across members ──────
  private tickPassiveFloats() {
    if (!this.isAlive) return
    // Only healthy buckets earn — broken bucket is not in droneBuckets.
    this.droneBuckets.forEach((bucket, key) => {
      const sprite = this.droneSprites.get(key)
      if (!sprite || !sprite.scene) return
      let sum = 0
      for (const d of bucket.members) sum += d.incomePerSec
      if (sum <= 0) return
      this.spawnPassiveFloat(sprite.x, sprite.y, this.formatPassive(sum))
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

  // ─── localStorage — keyed by bucketKey so positions survive DB drone changes ──
  private loadPositions(): Record<string, { x: number, y: number }> {
    try { return JSON.parse(localStorage.getItem(POSITIONS_KEY) || '{}') }
    catch { return {} }
  }

  private savePositions() {
    // Bucket positions are cosmetic and stay local. The server's per-unit
    // position_x/y columns are only meaningful when the farm displays every
    // unit individually — which stopped being the case once we switched to
    // bucketed rendering, so /user/sync isn't called from here anymore.
    const localStorage_pos: Record<string, { x: number, y: number }> = {}
    this.droneSprites.forEach((s, key) => {
      localStorage_pos[key] = { x: Math.round(s.x), y: Math.round(s.y) }
    })
    this.turretSprites.forEach((s, key) => {
      localStorage_pos[key] = { x: Math.round(s.x), y: Math.round(s.y) }
    })
    try { localStorage.setItem(POSITIONS_KEY, JSON.stringify(localStorage_pos)) } catch { /* quota */ }
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
