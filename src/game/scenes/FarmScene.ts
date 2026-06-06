import Phaser from 'phaser'
import { useGameStore, DRONE_UPGRADES, type Drone, type Turret } from '../../store/gameStore'
import { getDroneTextureName, getFarmTurretTextureName } from '../utils/droneGraphics'
import { soundManager } from '../utils/soundManager'
import { syncPositions as apiSyncPositions } from '../../api'

interface FloatingText { text: Phaser.GameObjects.Text; vy: number; life: number }

const GRID_COLS   = 3
const DRONE_CELL  = 150
const TURRET_CELL = 130
const POSITIONS_KEY = 'cyber-farm-positions'
const DRONE_START_Y = 120   // world Y where drones begin

export class FarmScene extends Phaser.Scene {
  private droneSprites:   Map<string, Phaser.GameObjects.Image> = new Map()
  private turretSprites:  Map<string, Phaser.GameObjects.Image> = new Map()
  private brokenLabels:   Map<string, Phaser.GameObjects.Text>  = new Map()
  private levelLabels:    Map<string, Phaser.GameObjects.Text>  = new Map()
  private turretLabels:   Map<string, Phaser.GameObjects.Text>  = new Map()
  private hoverTweens:    Map<string, Phaser.Tweens.Tween>      = new Map()
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
    this.createGridLines(W, this.worldH)
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
    const separatorH  = 80
    const turretZoneH = tc > 0 ? separatorH + turretRows * TURRET_CELL + 120 : 80
    return Math.max(H * 2.2, droneZoneH + turretZoneH)
  }

  private separatorY(droneCount: number): number {
    const rows = Math.ceil(Math.max(droneCount, 1) / GRID_COLS)
    return DRONE_START_Y + rows * DRONE_CELL + 60
  }

  // ─── Background (extends 2000px beyond world to avoid black edges) ──────────
  private drawBackground(W: number, worldH: number, droneCount: number) {
    const sepY = this.separatorY(droneCount)
    const PAD  = 2000

    const bg = this.add.graphics()
    // Base dark fill
    bg.fillStyle(0x0d1117, 1)
    bg.fillRect(-PAD, -PAD, W + PAD * 2, worldH + PAD * 2)

    // Drone zone overlay
    bg.fillStyle(0x0d1420, 1)
    bg.fillRect(-PAD, -PAD, W + PAD * 2, sepY + PAD)

    // Defense zone overlay
    bg.fillStyle(0x0a1e10, 1)
    bg.fillRect(-PAD, sepY, W + PAD * 2, worldH - sepY + PAD)

    // Separator line
    bg.lineStyle(2, 0x00e5ff, 0.28)
    bg.lineBetween(-PAD, sepY, W + PAD, sepY)

    // Zone labels
    this.add.text(10, 68, 'DRONE ZONE', {
      fontSize: '9px', fontFamily: 'monospace', color: '#00e5ff',
    }).setAlpha(0.28).setDepth(0)

    this.add.text(10, sepY + 8, 'DEFENSE ZONE', {
      fontSize: '9px', fontFamily: 'monospace', color: '#00cc44',
    }).setAlpha(0.28).setDepth(0)
  }

  private createGridLines(W: number, worldH: number) {
    // Extend grid 2000px beyond world so zooming out never shows raw black
    const PAD  = 2000
    const step = 40
    const grid = this.add.graphics()
    grid.lineStyle(1, 0x00e5ff, 0.055)
    for (let x = -PAD; x < W + PAD; x += step) grid.lineBetween(x, -PAD, x, worldH + PAD)
    for (let y = -PAD; y < worldH + PAD; y += step) grid.lineBetween(-PAD, y, W + PAD, y)
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

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('farm-zoom', onZoom)
      canvas.removeEventListener('farm-reset-view', onReset)
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
    const sprite = this.add.image(x, y, tex).setScale(0.78).setDepth(5)
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
    const label = this.add.text(sprite.x, sprite.y - 52, '⚠ Сломан', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ff6666',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(6)
    this.brokenLabels.set(id, label)
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
  private onDroneTap(sprite: Phaser.GameObjects.Image, _id: string, wx: number, wy: number) {
    const store = useGameStore.getState()
    if (store.energy <= 0) {
      this.spawnFloatingText(wx, wy, 'Нет энергии!', '#ff6666')
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

    // Save to localStorage (instant, offline-friendly)
    try { localStorage.setItem(POSITIONS_KEY, JSON.stringify(localStorage_pos)) } catch { /* quota */ }

    // Sync to API (persists across devices and sessions)
    apiSyncPositions(dronePos, turretPos).catch(() => { /* silent — positions are cosmetic */ })
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
