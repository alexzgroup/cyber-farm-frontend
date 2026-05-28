import Phaser from 'phaser'
import { FarmScene } from './FarmScene'
import { paintDrone } from '../utils/droneGraphics'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {}

  create() {
    const dg = this.make.graphics({ x: 0, y: 0, add: false })
    paintDrone(dg, false)
    dg.generateTexture('drone', 128, 128)
    dg.destroy()

    const bg = this.make.graphics({ x: 0, y: 0, add: false })
    paintDrone(bg, true)
    bg.generateTexture('drone_broken', 128, 128)
    bg.destroy()

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
