import Phaser from 'phaser'
import { FarmScene } from './FarmScene'
import { paintDrone, paintFarmTurret } from '../utils/droneGraphics'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {}

  create() {
    // ── Drone textures: 3 types × 2 states ──
    const types: Array<1 | 2 | 3> = [1, 2, 3]
    for (const t of types) {
      const g = this.make.graphics({ x: 0, y: 0, add: false })
      paintDrone(g, false, t)
      g.generateTexture(`drone_${t}`, 128, 128)
      g.destroy()

      const gb = this.make.graphics({ x: 0, y: 0, add: false })
      paintDrone(gb, true, t)
      gb.generateTexture(`drone_${t}_broken`, 128, 128)
      gb.destroy()
    }

    // ── Farm turret textures: 3 levels ──
    const levels: Array<1 | 2 | 3> = [1, 2, 3]
    for (const lv of levels) {
      const g = this.make.graphics({ x: 0, y: 0, add: false })
      paintFarmTurret(g, lv)
      g.generateTexture(`farm_turret_${lv}`, 128, 128)
      g.destroy()
    }

    // ── Coin particle ──
    const cg = this.make.graphics({ x: 0, y: 0, add: false })
    cg.fillStyle(0xffd700, 1)
    cg.fillCircle(8, 8, 8)
    cg.fillStyle(0xffaa00, 1)
    cg.fillCircle(8, 8, 5)
    cg.fillStyle(0xffee88, 0.8)
    cg.fillCircle(6, 6, 3)
    cg.generateTexture('coin_particle', 16, 16)
    cg.destroy()

    this.scene.start('FarmScene')
  }
}
