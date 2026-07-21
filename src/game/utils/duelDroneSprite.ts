import Phaser from 'phaser'
import {
  paintDuelDroneBody,
  paintDuelDroneRotor,
  DUEL_DRONE_ROTOR_OFFSETS,
} from './droneGraphics'

// Sprite-atlas keys, keyed by drone type.
const BODY_KEY  = (t: 1 | 2 | 3) => `duel_drone_body_${t}`
const ROTOR_KEY = (t: 1 | 2 | 3) => `duel_drone_rotor_${t}`

/** Bake body + rotor textures for one drone type into the scene's TextureManager.
 *  Idempotent — safe to call multiple times per scene.
 */
export function ensureDuelDroneTextures(scene: Phaser.Scene, type: 1 | 2 | 3) {
  const bk = BODY_KEY(type)
  if (!scene.textures.exists(bk)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false)
    paintDuelDroneBody(g, type)
    g.generateTexture(bk, 128, 128)
    g.destroy()
  }
  const rk = ROTOR_KEY(type)
  if (!scene.textures.exists(rk)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false)
    paintDuelDroneRotor(g, type)
    g.generateTexture(rk, 32, 32)
    g.destroy()
  }
}

/** A composite drone — a Phaser Container that owns the body sprite plus
 *  four spinning rotor sprites. Move the container as a single unit;
 *  the rotors keep spinning automatically via the scene's update loop
 *  (call `spin(delta)` from your scene.update).
 */
export class DuelDroneSprite extends Phaser.GameObjects.Container {
  // Renamed away from `body` — Phaser.GameObjects.Container has a
  // (physics) `body` property in its type defs, so subclassing with a
  // different-typed `body` field fails TS structural-compatibility.
  private bodySprite: Phaser.GameObjects.Image
  private rotors: Phaser.GameObjects.Image[] = []
  private rotorSpeed: number // rad/ms

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    type: 1 | 2 | 3 = 1,
    opts: { scale?: number; rotorSpeed?: number } = {},
  ) {
    super(scene, x, y)
    ensureDuelDroneTextures(scene, type)

    const scale = opts.scale ?? 1
    this.rotorSpeed = opts.rotorSpeed ?? 0.05 // rad/ms → ~8 revs/sec

    // Body — depth 0 inside the container (rotors sit on top).
    this.bodySprite = scene.add.image(0, 0, BODY_KEY(type))
    this.add(this.bodySprite)

    // 4 rotor sprites at the X-pattern offsets. Because the body texture
    // is 128×128 with centre 64,64 and the offsets are unscaled px, the
    // rotor sits precisely on the ring/hub already painted into the body.
    for (const [dx, dy] of DUEL_DRONE_ROTOR_OFFSETS) {
      const r = scene.add.image(dx, dy, ROTOR_KEY(type))
      r.setBlendMode(Phaser.BlendModes.ADD) // brighter, "spinning fast" look
      this.add(r)
      this.rotors.push(r)
    }

    this.setScale(scale)
    // Register with the scene's display list. `scene.add.existing` has an
    // overload signature that doesn't include Container in some Phaser
    // typings — call the underlying display-list add directly to sidestep
    // that mismatch.
    scene.sys.displayList.add(this)
    scene.sys.updateList.add(this)
  }

  /** Advance the rotor rotation. Call from scene.update(_, delta). */
  spin(delta: number) {
    const inc = this.rotorSpeed * delta
    for (const r of this.rotors) r.rotation += inc
  }

  /** Optional: speed up/slow down (e.g. for boost or damage effects). */
  setRotorSpeed(radPerMs: number) { this.rotorSpeed = radPerMs }
}
