import Phaser from 'phaser'
import { useGameStore, DRONE_UPGRADES } from '../../store/gameStore'

interface FloatingText {
  text: Phaser.GameObjects.Text
  vy: number
  life: number
}

export class FarmScene extends Phaser.Scene {
  private droneSprites: Map<string, Phaser.GameObjects.Image> = new Map()
  private brokenLabels: Map<string, Phaser.GameObjects.Text> = new Map()
  private floatingTexts: FloatingText[] = []
  private emitter!: Phaser.GameObjects.Particles.ParticleEmitter
  private groundY = 0
  private unsubscribeStore?: () => void
  private isAlive = false

  constructor() {
    super({ key: 'FarmScene' })
  }

  create() {
    const { width, height } = this.scale
    this.groundY = height * 0.52

    this.drawBackground(width, height)
    this.createGrid(width, height)
    this.createParticles()
    this.spawnInitialDrones()

    this.isAlive = true

    // Full sync on any store change (handles add/upgrade/break)
    this.unsubscribeStore = useGameStore.subscribe((state) => this.syncDrones(state.drones))

    const cleanup = () => { this.isAlive = false; this.unsubscribeStore?.() }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup)
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup)
  }

  private drawBackground(w: number, h: number) {
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x0d1117, 0x0d1117, 0x0a2a1a, 0x0a2a1a, 1)
    bg.fillRect(0, 0, w, h)
    bg.fillStyle(0x143020, 0.8)
    bg.fillRect(0, h * 0.55, w, h * 0.45)
    bg.lineStyle(2, 0x00e5ff, 0.3)
    bg.lineBetween(0, h * 0.55, w, h * 0.55)
  }

  private createGrid(w: number, h: number) {
    const grid = this.add.graphics()
    grid.lineStyle(1, 0x00e5ff, 0.06)
    const step = 40
    for (let x = 0; x < w; x += step) grid.lineBetween(x, 0, x, h)
    for (let y = 0; y < h; y += step) grid.lineBetween(0, y, w, y)
  }

  private createParticles() {
    this.emitter = this.add.particles(0, 0, 'coin_particle', {
      speed: { min: 60, max: 120 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 600,
      quantity: 6,
      emitting: false,
    })
  }

  private spawnInitialDrones() {
    const { drones } = useGameStore.getState()
    drones.forEach((drone) => this.addDroneSprite(drone.id, drone.level, drone.isBroken))
    this.repositionDrones()
  }

  private addDroneSprite(id: string, level: number, isBroken: boolean) {
    const texture = isBroken ? 'drone_broken' : 'drone'
    const sprite = this.add.image(0, this.groundY, texture)
      .setScale(0.78)
      .setInteractive({ useHandCursor: true })

    sprite.setData('droneId', id)
    this.droneSprites.set(id, sprite)

    const idx = this.droneSprites.size - 1
    this.tweens.add({
      targets: sprite,
      y: this.groundY - 16,
      duration: 1400 + idx * 200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    sprite.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this.onDroneTap(sprite, id, ptr.x, ptr.y)
    })

    if (isBroken) this.addBrokenLabel(id, sprite)
  }

  private addBrokenLabel(id: string, sprite: Phaser.GameObjects.Image) {
    const label = this.add.text(sprite.x, sprite.y - 50, '⚠ Сломан', {
      fontSize: '12px', fontFamily: 'monospace', color: '#ff6666',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5)
    this.brokenLabels.set(id, label)
  }

  private repositionDrones() {
    const { width } = this.scale
    const sprites = [...this.droneSprites.values()]
    sprites.forEach((sprite, i) => {
      const x = width / 2 + (i - (sprites.length - 1) / 2) * 130
      sprite.x = x
    })
  }

  private onDroneTap(sprite: Phaser.GameObjects.Image, _id: string, x: number, y: number) {
    const store = useGameStore.getState()
    if (store.energy <= 0) {
      this.spawnFloatingText(x, y, 'Нет энергии!', '#ff6666')
      return
    }

    const maxLevel = Math.max(...store.drones.map((d) => d.level))
    const bonus = DRONE_UPGRADES[maxLevel - 1].tapBonus

    store.tap()
    this.emitter.setPosition(x, y)
    this.emitter.explode(6)

    this.tweens.add({
      targets: sprite,
      scaleX: 0.92,
      scaleY: 0.62,
      duration: 80,
      yoyo: true,
      ease: 'Bounce.Out',
    })

    this.spawnFloatingText(x, y - 20, `+${bonus.toFixed(1)}`, '#ffd700')
  }

  private spawnFloatingText(x: number, y: number, msg: string, color: string) {
    const t = this.add.text(x, y, msg, {
      fontSize: '18px',
      fontFamily: 'monospace',
      color,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5)

    this.floatingTexts.push({ text: t, vy: -1.5, life: 60 })
  }

  private syncDrones(drones: ReturnType<typeof useGameStore.getState>['drones']) {
    if (!this.isAlive) return
    // Add new drones
    drones.forEach((drone) => {
      if (!this.droneSprites.has(drone.id)) {
        this.addDroneSprite(drone.id, drone.level, drone.isBroken)
        this.repositionDrones()
      }
    })

    // Sync texture + broken label
    drones.forEach((drone) => {
      const sprite = this.droneSprites.get(drone.id)
      if (!sprite || !sprite.scene) return  // destroyed sprite guard

      const texture = drone.isBroken ? 'drone_broken' : 'drone'
      if (sprite.texture.key !== texture) sprite.setTexture(texture)

      const hasLabel = this.brokenLabels.has(drone.id)
      if (drone.isBroken && !hasLabel) {
        this.addBrokenLabel(drone.id, sprite)
      } else if (!drone.isBroken && hasLabel) {
        this.brokenLabels.get(drone.id)?.destroy()
        this.brokenLabels.delete(drone.id)
      }
    })

    // Keep labels positioned over drones
    this.brokenLabels.forEach((label, id) => {
      const sprite = this.droneSprites.get(id)
      if (sprite) { label.x = sprite.x; label.y = sprite.y - 50 }
    })
  }

  update() {
    this.floatingTexts = this.floatingTexts.filter((ft, idx) => {
      ft.text.y += ft.vy
      ft.text.alpha -= 1 / 60
      ft.life--
      if (ft.life <= 0) { ft.text.destroy(); return false }
      return true
    })
  }
}
