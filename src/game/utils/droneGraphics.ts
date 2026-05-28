import Phaser from 'phaser'

/**
 * Paints a detailed pseudo-3D X-frame quadcopter onto `g`.
 * Target canvas: 128×128. Call generateTexture() after.
 */
export function paintDrone(g: Phaser.GameObjects.Graphics, broken: boolean) {
  const bodyTop   = broken ? 0xff3333 : 0x00ccee
  const bodyBot   = broken ? 0x660000 : 0x004466
  const bodyHilit = broken ? 0xff9999 : 0x88eeff
  const armCol    = broken ? 0x882222 : 0x007799
  const armHilit  = broken ? 0xcc4444 : 0x00bbcc
  const propFront = broken ? 0xff6600 : 0x33ff33
  const propBack  = broken ? 0x994400 : 0x228822
  const ledL      = broken ? 0x660000 : 0xff1111
  const ledR      = broken ? 0x664400 : 0x00ff44
  const cockpit   = broken ? 0x220000 : 0x001830
  const lens      = broken ? 0x880000 : 0x0055cc

  // X-frame prop positions (near the 4 corners of 128×128)
  const FLx = 22,  FLy = 24   // front-left
  const FRx = 106, FRy = 24   // front-right
  const BLx = 22,  BLy = 96   // back-left
  const BRx = 106, BRy = 96   // back-right

  // Arm anchor points on body edge
  const AFL = { x: 48, y: 52 }
  const AFR = { x: 80, y: 52 }
  const ABL = { x: 48, y: 68 }
  const ABR = { x: 80, y: 68 }

  // Ground shadow
  g.fillStyle(0x000000, 0.28)
  g.fillEllipse(66, 116, 88, 14)

  // ── BACK ARMS (drawn behind body) ──
  g.lineStyle(7, bodyBot, 1)
  g.lineBetween(ABL.x, ABL.y, BLx, BLy)
  g.lineBetween(ABR.x, ABR.y, BRx, BRy)

  // ── BACK PROPS (dimmer — visually "behind") ──
  paintProp(g, BLx, BLy, propBack, 0.55)
  paintProp(g, BRx, BRy, propBack, 0.55)

  // ── BODY depth face ──
  g.fillStyle(bodyBot, 1)
  g.fillRoundedRect(38, 58, 52, 22, 8)

  // ── BODY top face ──
  g.fillStyle(bodyTop, 1)
  g.fillRoundedRect(38, 48, 52, 26, 8)

  // ── BODY highlight strip ──
  g.fillStyle(bodyHilit, 0.38)
  g.fillRoundedRect(40, 49, 48, 9, 7)

  // ── FRONT ARMS ──
  g.lineStyle(7, armCol, 1)
  g.lineBetween(AFL.x, AFL.y, FLx, FLy)
  g.lineBetween(AFR.x, AFR.y, FRx, FRy)
  g.lineStyle(2, armHilit, 0.45)
  g.lineBetween(AFL.x, AFL.y, FLx, FLy)
  g.lineBetween(AFR.x, AFR.y, FRx, FRy)

  // ── COCKPIT dome ──
  g.fillStyle(cockpit, 1)
  g.fillEllipse(64, 58, 26, 18)
  if (!broken) {
    g.fillStyle(0x002244, 0.85)
    g.fillEllipse(64, 59, 20, 13)
    g.fillStyle(0xffffff, 0.16)   // glass reflection
    g.fillEllipse(60, 55, 9, 6)
  }
  // Camera lens
  g.fillStyle(lens, 1)
  g.fillCircle(64, 59, 5)
  g.fillStyle(0x66aadd, 0.75)
  g.fillCircle(65, 58, 3)
  g.fillStyle(0xffffff, 0.5)
  g.fillCircle(63, 57, 1.5)

  // ── FRONT PROPS (brighter — visually "in front") ──
  paintProp(g, FLx, FLy, propFront, 1)
  paintProp(g, FRx, FRy, propFront, 1)

  // ── NAV LEDs ──
  g.fillStyle(ledL, 1)
  g.fillCircle(40, 54, 3)
  g.fillStyle(ledL, 0.22)
  g.fillCircle(40, 54, 6)

  g.fillStyle(ledR, 1)
  g.fillCircle(88, 54, 3)
  g.fillStyle(ledR, 0.22)
  g.fillCircle(88, 54, 6)

  // Tail status light
  g.fillStyle(broken ? 0x444444 : 0x4488ff, 1)
  g.fillCircle(64, 71, 2)

  // ── GLOW OUTLINE / DAMAGE MARKS ──
  if (!broken) {
    g.lineStyle(1.5, 0x00e5ff, 0.5)
    g.strokeRoundedRect(37, 47, 54, 28, 9)
    g.lineStyle(1, 0x00e5ff, 0.18)
    g.strokeEllipse(64, 76, 80, 18)
  } else {
    g.lineStyle(2, 0xff8800, 0.7)
    g.lineBetween(50, 50, 60, 62)
    g.lineBetween(72, 48, 80, 58)
    g.lineStyle(1, 0xff4400, 0.45)
    g.lineBetween(55, 52, 64, 48)
  }
}

function paintProp(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number,
  color: number, alpha: number,
) {
  g.fillStyle(color, 0.07 * alpha)
  g.fillCircle(x, y, 20)
  g.fillStyle(color, 0.18 * alpha)
  g.fillCircle(x, y, 14)
  g.fillStyle(color, 0.5 * alpha)
  g.fillEllipse(x, y, 22, 6)
  g.fillStyle(0x001e2a, alpha)
  g.fillCircle(x, y, 8)
  g.lineStyle(1.5, 0x008899, alpha * 0.9)
  g.strokeCircle(x, y, 8)
  g.fillStyle(0x00aacc, alpha)
  g.fillCircle(x, y, 4)
  g.fillStyle(0xffffff, 0.65 * alpha)
  g.fillCircle(x, y, 1.5)
}
