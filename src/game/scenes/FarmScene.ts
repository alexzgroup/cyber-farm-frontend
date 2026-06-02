import Phaser from 'phaser'
import { useGameStore, DRONE_UPGRADES, type Drone, type Turret } from '../../store/gameStore'
import { getDroneTextureName, getFarmTurretTextureName } from '../utils/droneGraphics'
import { soundManager } from '../utils/soundManager'

interface FloatingText { text: Phaser.GameObjects.Text; vy: number; life: number }

const GRID_COLS   = 3
const DRONE_CELL  = 140   // vertical spacing for drones
const TURRET_CELL = 120   // vertical spacing for turrets
const POSITIONS_KEY = 'cyber-farm-positions'

export class FarmScene extends Phaser.Scene {
  private droneSprites:  Map<string, Phaser.GameObjects.Image> = new Map()
  private turretSprites: Map<string, Phaser.GameObjects.Image> = new Map()
  private brokenLabels:  Map<string, Phaser.GameObjects.Text>  = new Map()
  private levelLabels:   Map<string, Phaser.GameObjects.Text>  = new Map()
  private turretLabels:  Map<string, Phaser.GameObjects.Text>  = new Map()
  private hoverTweens:   Map<string, Phaser.Tweens.Tween>      = new Map()
  private floatingTexts: FloatingText[] = []
  private emitter!: Phaser.GameObjects.Particles.ParticleEmitter
  private unsubscribeStore?: () => void
  private isAlive = false

  constructor() { super({ key: 'FarmScene' }) }

  create() {
    const { width: W, height: H } = this.scale
    this.drawBackground(W, H)
    this.createGridLines(W, H)
    this.createParticles()
    this.spawnInitialDrones()
    this.spawnInitialTurrets()
    this.setupDrag()

    this.isAlive = true
    this.unsubscribeStore = useGameStore.subscribe((state) => {
      this.syncDrones(state.drones)
    })

    // Passive income floats — one per second per drone
    this.time.addEvent({
      delay: 1000,
      repeat: -1,
      callback: this.tickPassiveFloats,
      callbackScope: this,
    })

    const cleanup = () => { this.isAlive = false; this.unsubscribeStore?.() }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup)
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup)
  }

  // ─── Background ─────────────────────────────────────────────────────────────
  private drawBackground(W: number, H: number) {
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x0d1117, 0x0d1117, 0x0a2a1a, 0x0a2a1a, 1)
    bg.fillRect(0, 0, W, H)
    bg.fillStyle(0x143020, 0.8)
    bg.fillRect(0, H * 0.62, W, H * 0.38)
    bg.lineStyle(2, 0x00e5ff, 0.3)
    bg.lineBetween(0, H * 0.62, W, H * 0.62)

    // Drone zone hint
    this.add.text(10, 68, 'DRONE ZONE', {
      fontSize: '9px', fontFamily: 'monospace', color: '#00e5ff',
    }).setAlpha(0.28).setDepth(0)

    // Turret zone hint
    this.add.text(10, H * 0.62 + 8, 'DEFENSE ZONE', {
      fontSize: '9px', fontFamily: 'monospace', color: '#00cc44',
    }).setAlpha(0.28).setDepth(0)
  }

  private createGridLines(W: number, H: number) {
    const grid = this.add.graphics()
    grid.lineStyle(1, 0x00e5ff, 0.06)
    const step = 40
    for (let x = 0; x < W; x += step) grid.lineBetween(x, 0, x, H)
    for (let y = 0; y < H; y += step) grid.lineBetween(0, y, W, y)
  }

  private createParticles() {
    this.emitter = this.add.particles(0, 0, 'coin_particle', {
      speed: { min: 60, max: 120 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 600, quantity: 6, emitting: false,
    })
  }

  // ─── Spawn drones ────────────────────────────────────────────────────────────
  private spawnInitialDrones() {
    const { drones } = useGameStore.getState()
    const saved = this.loadPositions()
    drones.forEach((drone, i) => {
      const pos = saved[drone.id] ?? this.defaultDronePos(i, drones.length)
      this.addDroneSprite(drone, pos.x, pos.y)
    })
  }

  private defaultDronePos(idx: number, total: number): { x: number, y: number } {
    const W = this.scale.width, H = this.scale.height
    const cols = Math.min(total, GRID_COLS)
    const rows = Math.ceil(total / cols)
    const cellW = W / (cols + 1)
    const groundY = H * 0.62
    const availH = groundY - 80
    const gridH = rows * DRONE_CELL
    const startY = (availH - gridH) / 2 + 80 + DRONE_CELL / 2
    return {
      x: (idx % cols + 1) * cellW,
      y: startY + Math.floor(idx / cols) * DRONE_CELL,
    }
  }

  private addDroneSprite(drone: Drone, x: number, y: number) {
    const tex = getDroneTextureName(drone.droneType, drone.isBroken)
    const sprite = this.add.image(x, y, tex)
      .setScale(0.78)
      .setDepth(5)
    sprite.setInteractive({ useHandCursor: true, draggable: true })

    sprite.setData('objectId', drone.id)
    sprite.setData('kind', 'drone')
    this.droneSprites.set(drone.id, sprite)

    sprite.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this.onDroneTap(sprite, drone.id, ptr.x, ptr.y)
    })

    // Hover tween
    const tween = this.tweens.add({
      targets: sprite, y: y - 14,
      duration: 1400 + this.droneSprites.size * 200,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
    this.hoverTweens.set(drone.id, tween)

    // Level label
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

  // ─── Spawn turrets ───────────────────────────────────────────────────────────
  private spawnInitialTurrets() {
    const { turrets } = useGameStore.getState()
    const saved = this.loadPositions()
    turrets.forEach((turret, i) => {
      const pos = saved[turret.id] ?? this.defaultTurretPos(i, turrets.length)
      this.addTurretSprite(turret, pos.x, pos.y)
    })
  }

  private defaultTurretPos(idx: number, total: number): { x: number, y: number } {
    const W = this.scale.width, H = this.scale.height
    const cols = Math.min(total, GRID_COLS)
    const cellW = W / (cols + 1)
    const groundY = H * 0.62
    const startY = groundY + 80
    return {
      x: (idx % cols + 1) * cellW,
      y: startY + Math.floor(idx / cols) * TURRET_CELL,
    }
  }

  private addTurretSprite(turret: Turret, x: number, y: number) {
    const tex = getFarmTurretTextureName(turret.level)
    const sprite = this.add.image(x, y, tex)
      .setScale(0.65)
      .setInteractive({ useHandCursor: true, draggable: true })
      .setDepth(5)

    sprite.setData('objectId', turret.id)
    sprite.setData('kind', 'turret')
    this.turretSprites.set(turret.id, sprite)

    const lbl = this.add.text(x, y + 50, `DEF LV${turret.level}`, {
      fontSize: '10px', fontFamily: 'monospace', color: '#00cc44',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(6)
    this.turretLabels.set(turret.id, lbl)
  }

  // ─── Drag setup ─────────────────────────────────────────────────────────────
  private setupDrag() {
    const W = () => this.scale.width
    const H = () => this.scale.height

    this.input.on('dragstart', (_ptr: Phaser.Input.Pointer, obj: Phaser.GameObjects.Image) => {
      const id = obj.getData('objectId') as string
      // Pause hover tween for drones
      this.hoverTweens.get(id)?.pause()
      obj.setDepth(20)
    })

    this.input.on('drag', (_ptr: Phaser.Input.Pointer, obj: Phaser.GameObjects.Image, dx: number, dy: number) => {
      obj.x = Phaser.Math.Clamp(dx, 36, W() - 36)
      obj.y = Phaser.Math.Clamp(dy, 36, H() - 36)
      this.syncLabelsToSprites()
    })

    this.input.on('dragend', (_ptr: Phaser.Input.Pointer, obj: Phaser.GameObjects.Image) => {
      const id   = obj.getData('objectId') as string
      const kind = obj.getData('kind') as string
      obj.setDepth(5)

      if (kind === 'drone') {
        // Stop only the hover tween — never kill all tweens,
        // otherwise an in-progress tap animation gets cancelled mid-squish
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

  // ─── Label sync ─────────────────────────────────────────────────────────────
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

  // ─── Tap ────────────────────────────────────────────────────────────────────
  private onDroneTap(sprite: Phaser.GameObjects.Image, _id: string, x: number, y: number) {
    const store = useGameStore.getState()
    if (store.energy <= 0) {
      this.spawnFloatingText(x, y, 'Нет энергии!', '#ff6666')
      return
    }
    const maxLevel = Math.max(...store.drones.map((d) => d.level))
    const bonus = DRONE_UPGRADES[maxLevel - 1].tapBonus
    store.tap()
    soundManager.tap()
    soundManager.coin()
    this.emitter.setPosition(x, y)
    this.emitter.explode(6)
    // Squish down, then explicitly restore to original scale.
    // Avoid yoyo — it relies on captured start values which can be
    // wrong if another tween modified scale before this fires.
    this.tweens.add({
      targets: sprite, scaleX: 0.86, scaleY: 0.58,
      duration: 65, ease: 'Power2.Out',
      onComplete: () => {
        if (!sprite.scene) return
        this.tweens.add({
          targets: sprite, scaleX: 0.78, scaleY: 0.78,
          duration: 130, ease: 'Back.Out',
        })
      },
    })
    this.spawnFloatingText(x, y - 20, `+${bonus.toFixed(1)}`, '#ffd700')
  }

  private spawnFloatingText(x: number, y: number, msg: string, color: string) {
    const t = this.add.text(x, y, msg, {
      fontSize: '18px', fontFamily: 'monospace', color,
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10)
    this.floatingTexts.push({ text: t, vy: -1.5, life: 60 })
  }

  // ─── Store sync ─────────────────────────────────────────────────────────────
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

  // ─── localStorage ────────────────────────────────────────────────────────────
  private loadPositions(): Record<string, { x: number, y: number }> {
    try {
      return JSON.parse(localStorage.getItem(POSITIONS_KEY) || '{}')
    } catch {
      return {}
    }
  }

  private savePositions() {
    const positions: Record<string, { x: number, y: number }> = {}
    this.droneSprites.forEach((sprite, id)  => { positions[id] = { x: Math.round(sprite.x), y: Math.round(sprite.y) } })
    this.turretSprites.forEach((sprite, id) => { positions[id] = { x: Math.round(sprite.x), y: Math.round(sprite.y) } })
    try { localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions)) } catch { /* quota */ }
  }

  // ─── Passive income floats ──────────────────────────────────────────────────
  private tickPassiveFloats() {
    if (!this.isAlive) return
    const { drones } = useGameStore.getState()
    drones.forEach((drone) => {
      if (drone.isBroken) return
      const sprite = this.droneSprites.get(drone.id)
      if (!sprite || !sprite.scene) return
      const perSecond = drone.incomePerHour / 3600
      this.spawnPassiveFloat(sprite.x, sprite.y, this.formatPassive(perSecond))
    })
  }

  private spawnPassiveFloat(x: number, y: number, label: string) {
    const startY = y - 52
    const midY   = y - 88
    const endY   = y - 112

    const t = this.add.text(x, startY, label, {
      fontSize: '13px',
      fontFamily: 'monospace',
      color: '#66ffbb',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(8).setAlpha(0)

    // Rise + fade in
    this.tweens.add({
      targets: t,
      y: midY,
      alpha: 0.90,
      duration: 350,
      ease: 'Power1.Out',
      onComplete: () => {
        // Hold briefly, then continue rising and fade out
        this.tweens.add({
          targets: t,
          y: endY,
          alpha: 0,
          duration: 550,
          delay: 100,
          ease: 'Power1.In',
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

  // ─── Update loop ─────────────────────────────────────────────────────────────
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
