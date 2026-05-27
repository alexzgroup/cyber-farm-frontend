import Phaser from 'phaser'
import { useGameStore } from '../../store/gameStore'

interface FloatingText {
  text: Phaser.GameObjects.Text
  vy: number
  alpha: number
  life: number
}

export class FarmScene extends Phaser.Scene {
  private drones: Phaser.GameObjects.Image[] = []
  private floatingTexts: FloatingText[] = []
  private emitter!: Phaser.GameObjects.Particles.ParticleEmitter
  private droneIds: string[] = []

  constructor() {
    super({ key: 'FarmScene' })
  }

  create() {
    const { width, height } = this.scale

    this.drawBackground(width, height)
    this.createGrid(width, height)
    this.createParticles()
    this.spawnDrones(width, height)

    // Passive income ticker every second
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => useGameStore.getState().tickPassiveIncome(),
    })

    // Sync drones state
    useGameStore.subscribe((state) => this.syncDrones(state.drones))
  }

  private drawBackground(w: number, h: number) {
    const bg = this.add.graphics()

    // Dark gradient base
    bg.fillGradientStyle(0x0d1117, 0x0d1117, 0x0a2a1a, 0x0a2a1a, 1)
    bg.fillRect(0, 0, w, h)

    // Ground platform
    bg.fillStyle(0x143020, 0.8)
    bg.fillRect(0, h * 0.55, w, h * 0.45)

    // Ground line
    bg.lineStyle(2, 0x00e5ff, 0.3)
    bg.lineBetween(0, h * 0.55, w, h * 0.55)
  }

  private createGrid(w: number, h: number) {
    const grid = this.add.graphics()
    grid.lineStyle(1, 0x00e5ff, 0.06)

    const step = 40
    for (let x = 0; x < w; x += step) {
      grid.lineBetween(x, 0, x, h)
    }
    for (let y = 0; y < h; y += step) {
      grid.lineBetween(0, y, w, y)
    }
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

  private spawnDrones(w: number, h: number) {
    const store = useGameStore.getState()
    const groundY = h * 0.52

    store.drones.forEach((drone, i) => {
      const x = w / 2 + (i - (store.drones.length - 1) / 2) * 110
      const texture = drone.isBroken ? 'drone_broken' : 'drone'
      const sprite = this.add.image(x, groundY, texture)
        .setScale(1.4)
        .setInteractive({ useHandCursor: true })

      sprite.setData('droneId', drone.id)
      this.drones.push(sprite)
      this.droneIds.push(drone.id)

      // Idle hover animation
      this.tweens.add({
        targets: sprite,
        y: groundY - 12,
        duration: 1400 + i * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })

      sprite.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
        this.onDroneTap(sprite, drone.id, ptr.x, ptr.y)
      })
    })
  }

  private onDroneTap(sprite: Phaser.GameObjects.Image, id: string, x: number, y: number) {
    const store = useGameStore.getState()
    if (store.energy <= 0) {
      this.spawnFloatingText(x, y, 'Нет энергии!', '#ff6666')
      return
    }

    store.tap()
    this.emitter.setPosition(x, y)
    this.emitter.explode(6)

    // Squish animation
    this.tweens.add({
      targets: sprite,
      scaleX: 1.6,
      scaleY: 1.1,
      duration: 80,
      yoyo: true,
      ease: 'Bounce.Out',
    })

    this.spawnFloatingText(x, y - 20, '+0.1', '#ffd700')
  }

  private spawnFloatingText(x: number, y: number, msg: string, color: string) {
    const t = this.add.text(x, y, msg, {
      fontSize: '18px',
      fontFamily: 'monospace',
      color,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5)

    this.floatingTexts.push({ text: t, vy: -1.5, alpha: 1, life: 60 })
  }

  private syncDrones(drones: ReturnType<typeof useGameStore.getState>['drones']) {
    drones.forEach((drone, i) => {
      const sprite = this.drones[i]
      if (!sprite) return
      const texture = drone.isBroken ? 'drone_broken' : 'drone'
      if (sprite.texture.key !== texture) sprite.setTexture(texture)
    })
  }

  update() {
    this.floatingTexts = this.floatingTexts.filter(({ text, vy, alpha, life }, idx) => {
      text.y += vy
      text.alpha -= 1 / 60
      this.floatingTexts[idx].life--
      if (this.floatingTexts[idx].life <= 0) {
        text.destroy()
        return false
      }
      return true
    })
  }
}
