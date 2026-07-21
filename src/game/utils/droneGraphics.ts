import Phaser from 'phaser'

// ─── Color palettes ───────────────────────────────────────────────────────────
interface DronePalette {
  bodyTop: number; bodyBot: number; bodyHilit: number
  armCol: number;  armHilit: number
  propFront: number; propBack: number
  ledL: number; ledR: number
  cockpit: number; lens: number
  glow: number
}

const PALETTES: Record<1 | 2 | 3, DronePalette> = {
  1: {  // Classic blue
    bodyTop: 0x00ccee, bodyBot: 0x004466, bodyHilit: 0x88eeff,
    armCol: 0x007799, armHilit: 0x00bbcc,
    propFront: 0x33ff33, propBack: 0x228822,
    ledL: 0xff1111, ledR: 0x00ff44,
    cockpit: 0x001830, lens: 0x0055cc, glow: 0x00e5ff,
  },
  2: {  // Combat red/orange
    bodyTop: 0xff4400, bodyBot: 0x661100, bodyHilit: 0xff9966,
    armCol: 0x882200, armHilit: 0xff6622,
    propFront: 0xff8800, propBack: 0xcc5500,
    ledL: 0xffcc00, ledR: 0xff2200,
    cockpit: 0x1a0000, lens: 0xff2200, glow: 0xff4400,
  },
  3: {  // Stealth purple
    bodyTop: 0x9900ff, bodyBot: 0x220044, bodyHilit: 0xcc88ff,
    armCol: 0x5500aa, armHilit: 0xaa44ff,
    propFront: 0xcc00ff, propBack: 0x880099,
    ledL: 0xff00ff, ledR: 0xcc00ff,
    cockpit: 0x0a0015, lens: 0xaa00ff, glow: 0xcc00ff,
  },
}

const BROKEN: DronePalette = {
  bodyTop: 0xff3333, bodyBot: 0x660000, bodyHilit: 0xff9999,
  armCol: 0x882222, armHilit: 0xcc4444,
  propFront: 0xff6600, propBack: 0x994400,
  ledL: 0x660000, ledR: 0x664400,
  cockpit: 0x220000, lens: 0x880000, glow: 0xff4400,
}

// ─── Main drone painter (round front-facing body with 3D depth cues) ────────
// Round drone silhouette (rounded-rect body + 4 arms out to circular rotors)
// is what users associate with a "cyber drone". The 3D feel is added through
// layering, not through changing the silhouette:
//   - dark belly slab peeking below the top body → gives depth
//   - glossy top highlight + rim outline → curved-metal cue
//   - front rotors bigger + more opaque than back rotors → foreshortening
//   - canopy sits raised, with lens + reflection + top rim arc
export function paintDrone(
  g: Phaser.GameObjects.Graphics,
  broken: boolean,
  type: 1 | 2 | 3 = 1,
) {
  const c = broken ? BROKEN : PALETTES[type]

  // Rotor anchors — X pattern, back rotors slightly smaller (perspective cue).
  const FLx = 22,  FLy = 96
  const FRx = 106, FRy = 96
  const BLx = 26,  BLy = 28
  const BRx = 102, BRy = 28
  const AFL = { x: 50, y: 68 }
  const AFR = { x: 78, y: 68 }
  const ABL = { x: 50, y: 52 }
  const ABR = { x: 78, y: 52 }

  // ── Tight ground shadow only ───────────────────────────────────────────────
  g.fillStyle(0x000000, 0.42)
  g.fillEllipse(64, 118, 68, 8)

  // ── Back rotors + arms (behind hull, thinner) ──────────────────────────────
  paintProp(g, BLx, BLy, c.propBack, 0.6, 0.85)
  paintProp(g, BRx, BRy, c.propBack, 0.6, 0.85)
  g.lineStyle(6, c.bodyBot, 1)
  g.lineBetween(ABL.x, ABL.y, BLx, BLy)
  g.lineBetween(ABR.x, ABR.y, BRx, BRy)

  // ── Body — round rectangle with two layers for a 3D thickness illusion.
  // Belly (peeks out below the top body)
  g.fillStyle(c.bodyBot, 1)
  g.fillRoundedRect(37, 61, 54, 24, 12)
  g.fillStyle(0x000000, 0.24)
  g.fillRoundedRect(38, 78, 52, 6, 5)
  // Main top body
  g.fillStyle(c.bodyTop, 1)
  g.fillRoundedRect(38, 46, 52, 30, 14)
  // Top glossy strip (roundness cue)
  g.fillStyle(c.bodyHilit, 0.55)
  g.fillRoundedRect(40, 48, 48, 8, 8)
  g.fillStyle(0xffffff, 0.15)
  g.fillRoundedRect(42, 49, 44, 4, 4)

  // ── Front arms (thicker, closer) ───────────────────────────────────────────
  g.lineStyle(8, c.armCol, 1)
  g.lineBetween(AFL.x, AFL.y, FLx, FLy)
  g.lineBetween(AFR.x, AFR.y, FRx, FRy)
  g.lineStyle(2, c.armHilit, 0.55)
  g.lineBetween(AFL.x, AFL.y - 1.5, FLx, FLy - 1.5)
  g.lineBetween(AFR.x, AFR.y - 1.5, FRx, FRy - 1.5)

  // ── Canopy — raised dome + lens ────────────────────────────────────────────
  if (!broken) {
    g.fillStyle(c.glow, 0.20)
    g.fillEllipse(64, 58, 32, 22)
  }
  g.fillStyle(c.cockpit, 1)
  g.fillEllipse(64, 58, 26, 18)
  if (!broken) {
    g.fillStyle(0x002244, 0.85)
    g.fillEllipse(64, 59, 20, 13)
    g.fillStyle(0xffffff, 0.20)
    g.fillEllipse(60, 55, 9, 6)
  }
  g.fillStyle(c.lens, 1);       g.fillCircle(64, 59, 5.5)
  g.fillStyle(0x66aadd, 0.85);  g.fillCircle(65, 58, 3.5)
  g.fillStyle(0xffffff, 0.85);  g.fillCircle(62, 57, 1.8)
  if (!broken) {
    g.lineStyle(1.2, 0xffffff, 0.35)
    g.beginPath()
    g.arc(64, 58, 12.5, Math.PI * 1.15, Math.PI * 1.85, false)
    g.strokePath()
  }

  // ── Front rotors on top (bigger + brighter) ────────────────────────────────
  paintProp(g, FLx, FLy, c.propFront, 1, 1)
  paintProp(g, FRx, FRy, c.propFront, 1, 1)

  // ── Nav LEDs on the front-facing edge ──────────────────────────────────────
  g.fillStyle(c.ledL, 1);    g.fillCircle(42, 68, 3)
  g.fillStyle(c.ledL, 0.28); g.fillCircle(42, 68, 7)
  g.fillStyle(c.ledR, 1);    g.fillCircle(86, 68, 3)
  g.fillStyle(c.ledR, 0.28); g.fillCircle(86, 68, 7)

  // Tail light
  g.fillStyle(broken ? 0x444444 : c.glow, 1)
  g.fillCircle(64, 44, 2)

  // ── Rim / damage overlay ───────────────────────────────────────────────────
  if (!broken) {
    g.lineStyle(2, c.glow, 0.55)
    g.strokeRoundedRect(37, 45, 54, 32, 14)
    g.lineStyle(1, c.bodyHilit, 0.35)
    g.strokeRoundedRect(38, 47, 52, 10, 8)
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
  color: number, scale = 1, alpha = 1,
) {
  const R = 8 * scale
  // Wide motion halo (three tiers) so the rotor reads as spinning at speed.
  g.fillStyle(color, 0.05 * alpha); g.fillCircle(x, y, R * 3.0)
  g.fillStyle(color, 0.10 * alpha); g.fillCircle(x, y, R * 2.25)
  g.fillStyle(color, 0.22 * alpha); g.fillCircle(x, y, R * 1.5)
  // Motion-blur streak
  g.fillStyle(color, 0.55 * alpha); g.fillEllipse(x, y, R * 3.0, R * 0.6)
  g.fillStyle(0xffffff, 0.20 * alpha); g.fillEllipse(x, y, R * 2.5, R * 0.25)
  // Hub
  g.fillStyle(0x001e2a, alpha);  g.fillCircle(x, y, R)
  g.lineStyle(1.5, 0x008899, alpha * 0.9); g.strokeCircle(x, y, R)
  g.fillStyle(0x00aacc, alpha);   g.fillCircle(x, y, R * 0.5)
  g.fillStyle(0xffffff, 0.75 * alpha); g.fillCircle(x, y, R * 0.18)
}

// ─── Duel drone painter (top-down quadcopter, mock-based) ────────────────────
//
// Distinct from paintDrone (which is the farm/side-view drone). This is the
// blast-view we use inside DuelScene: 4 arms in an X, 4 rotor rings with
// spinning blades, central rounded body, cockpit sphere. Style comes from
// assets/new-dpad-duel-screen/index.html.
//
// `type`: 1 = cyan (challenger / friendly), 2 = red (opponent), 3 = violet.

interface DuelDronePalette {
  hue: number         // radial halo colour
  arm1: number; arm2: number     // linear gradient across the arms
  body1: number; body2: number; body3: number   // linear across central body
  ring: number        // rotor ring outline
  rotor: number       // rotor blade colour
  cockpit1: number; cockpit2: number  // cockpit sphere gradient
  strut: number       // dark stroke on central body
}

const DUEL_PALETTES: Record<1 | 2 | 3, DuelDronePalette> = {
  1: {
    hue: 0x28e0ff,
    arm1: 0x2ec8ff, arm2: 0x7b6bff,
    body1: 0x3df0ff, body2: 0x1aa9ff, body3: 0xa855f7,
    ring: 0x5fe0ff, rotor: 0xbdf4ff,
    cockpit1: 0x8fd6ff, cockpit2: 0x0f86d6,
    strut: 0x0c1830,
  },
  2: {
    hue: 0xff5e7a,
    arm1: 0xff7a3a, arm2: 0xff5e7a,
    body1: 0xff6a2a, body2: 0xff5e7a, body3: 0xff8a5a,
    ring: 0xff9a8a, rotor: 0xffd6c8,
    cockpit1: 0xffb0b8, cockpit2: 0xa61030,
    strut: 0x2a0810,
  },
  3: {
    hue: 0xcc00ff,
    arm1: 0xcc44ff, arm2: 0x8844ff,
    body1: 0xcc00ff, body2: 0x8800cc, body3: 0x330066,
    ring: 0xdd88ff, rotor: 0xf0d0ff,
    cockpit1: 0xd0a0ff, cockpit2: 0x4a0080,
    strut: 0x180030,
  },
}

// Rotor anchor offsets from the drone centre — the X-pattern (TL, TR, BL, BR).
// Exported so Phaser scenes can position their rotor sprites the same way.
export const DUEL_DRONE_ROTOR_OFFSETS: ReadonlyArray<[number, number]> = [
  [-36, -36], [ 36, -36], [-36,  36], [ 36,  36],
]

/**
 * Body-only painter for the duel drone (128×128, centre 64,64). Draws the
 * halo, arms, ring outlines, rotor hubs, cockpit, and the central rounded
 * body — but NOT the spinning blades. Use this for the static body texture;
 * pair with `paintDuelDroneRotor` sprites that spin on top of the hubs.
 */
export function paintDuelDroneBody(g: Phaser.GameObjects.Graphics, type: 1 | 2 | 3 = 1) {
  const c = DUEL_PALETTES[type]
  const CX = 64, CY = 64
  const rotors = DUEL_DRONE_ROTOR_OFFSETS.map(([dx, dy]) => [CX + dx, CY + dy] as const)

  g.fillStyle(c.hue, 0.16); g.fillCircle(CX, CY, 52)
  g.fillStyle(c.hue, 0.08); g.fillCircle(CX, CY, 66)

  g.lineStyle(6, c.arm1, 1)
  for (const [rx, ry] of rotors) g.lineBetween(CX, CY, rx, ry)
  g.lineStyle(3, c.arm2, 0.9)
  for (const [rx, ry] of rotors) g.lineBetween(CX, CY, rx, ry)

  g.fillStyle(c.body1, 1);    g.fillRoundedRect(CX - 18, CY - 18, 36, 36, 10)
  g.fillStyle(c.body2, 0.85); g.fillRoundedRect(CX - 15, CY - 15, 30, 30, 8)
  g.fillStyle(c.body3, 0.35); g.fillRoundedRect(CX - 10, CY - 10, 20, 20, 6)
  g.lineStyle(2, c.strut, 0.7)
  g.lineBetween(CX - 12, CY + 5,  CX - 6,  CY + 12)
  g.lineBetween(CX + 12, CY + 5,  CX + 6,  CY + 12)
  g.lineStyle(1, 0xffffff, 0.35); g.strokeRoundedRect(CX - 18, CY - 18, 36, 36, 10)

  // Rotor rings + hubs (STATIC; blades painted separately by paintDuelDroneRotor)
  for (const [rx, ry] of rotors) {
    g.lineStyle(1.5, c.ring, 0.65); g.strokeCircle(rx, ry, 16)
    g.fillStyle(c.hue, 0.05);        g.fillCircle(rx, ry, 16)
    g.fillStyle(c.body2, 1);         g.fillCircle(rx, ry, 4)
    g.lineStyle(1, 0xffffff, 0.4);   g.strokeCircle(rx, ry, 4)
  }

  // Cockpit
  g.fillStyle(c.cockpit2, 1);    g.fillCircle(CX, CY, 13)
  g.fillStyle(c.cockpit1, 0.85); g.fillCircle(CX, CY, 10)
  g.fillStyle(0xffffff, 0.7);    g.fillCircle(CX - 3, CY - 3, 4)
  g.fillStyle(0xffffff, 0.35);   g.fillCircle(CX - 4, CY - 4, 2)
  g.lineStyle(1, 0xbfe9ff, 0.85); g.strokeCircle(CX, CY, 13)
}

/**
 * Spinning rotor blades — 32×32 texture centred on (16, 16). Three
 * long semi-transparent ellipses arranged as a Y (0° / 120° / 240°).
 * Rotate the whole sprite with `rotor.rotation += dt * speed` to
 * animate. Because there are 3 blades, the blade pattern is
 * rotationally-symmetric every 120° — so any rotation looks correct.
 */
export function paintDuelDroneRotor(g: Phaser.GameObjects.Graphics, type: 1 | 2 | 3 = 1) {
  const c = DUEL_PALETTES[type]
  const CX = 16, CY = 16
  const halfW = 14, halfH = 3
  g.fillStyle(c.rotor, 0.28)
  for (let a = 0; a < 3; a++) {
    const th = (a * 120) * Math.PI / 180
    const cos = Math.cos(th), sin = Math.sin(th)
    // Approximate a rotated ellipse by stepping along its major axis
    // and painting dots — cheap on WebGL and reads as a soft motion blur.
    for (let s = -halfW; s <= halfW; s += 1.2) {
      g.fillCircle(CX + cos * s, CY + sin * s, halfH)
    }
  }
  // Tiny bright centre so the hub reads as spinning fast
  g.fillStyle(0xffffff, 0.55); g.fillCircle(CX, CY, 1.5)
}

/**
 * Legacy full-drone painter (body + baked-in static blades).
 * Kept for backward compatibility (BootScene / existing textures);
 * new duel code should use paintDuelDroneBody + paintDuelDroneRotor.
 */
export function paintDuelDrone(g: Phaser.GameObjects.Graphics, type: 1 | 2 | 3 = 1) {
  const c = DUEL_PALETTES[type]
  // Canvas centre. Drone body occupies ~104×104 inside the 128×128 quad, so
  // rotors sit at ±36 from centre.
  const CX = 64, CY = 64
  const RD = 36 // rotor distance from centre

  // Rotor anchor points (X-pattern: TL, TR, BL, BR).
  const rotors: Array<[number, number]> = [
    [CX - RD, CY - RD],
    [CX + RD, CY - RD],
    [CX - RD, CY + RD],
    [CX + RD, CY + RD],
  ]

  // ── Radial halo behind everything ─────────────────────────────────────────
  g.fillStyle(c.hue, 0.16); g.fillCircle(CX, CY, 52)
  g.fillStyle(c.hue, 0.08); g.fillCircle(CX, CY, 66)

  // ── Arms: two gradient-blended strokes per arm for a cheap "linear-grad"
  //    look. Outer stroke uses arm1, inner overlay uses arm2 — placed at
  //    depth 0 so rotors sit on top.
  g.lineStyle(6, c.arm1, 1)
  for (const [rx, ry] of rotors) g.lineBetween(CX, CY, rx, ry)
  g.lineStyle(3, c.arm2, 0.9)
  for (const [rx, ry] of rotors) g.lineBetween(CX, CY, rx, ry)

  // ── Central body: rounded square with two overlapping fills to fake
  //    the diagonal gradient of the SVG.
  g.fillStyle(c.body1, 1); g.fillRoundedRect(CX - 18, CY - 18, 36, 36, 10)
  g.fillStyle(c.body2, 0.85); g.fillRoundedRect(CX - 15, CY - 15, 30, 30, 8)
  g.fillStyle(c.body3, 0.35); g.fillRoundedRect(CX - 10, CY - 10, 20, 20, 6)
  // Dark struts across the belly for detail
  g.lineStyle(2, c.strut, 0.7)
  g.lineBetween(CX - 12, CY + 5,  CX - 6,  CY + 12)
  g.lineBetween(CX + 12, CY + 5,  CX + 6,  CY + 12)
  // Body outline
  g.lineStyle(1, 0xffffff, 0.35); g.strokeRoundedRect(CX - 18, CY - 18, 36, 36, 10)

  // ── Rotor rings + blades ──────────────────────────────────────────────────
  for (const [rx, ry] of rotors) {
    // Blade halo — three overlapping ellipses at 0°/60°/120° for a
    // frozen-motion look. Alpha low so it reads as "spinning".
    g.fillStyle(c.rotor, 0.22)
    for (let a = 0; a < 3; a++) {
      const th = (a * 60) * Math.PI / 180
      const cos = Math.cos(th), sin = Math.sin(th)
      // Approximate rotated ellipse: fill a series of short strokes.
      const halfW = 15, halfH = 3.2
      for (let s = -halfW; s <= halfW; s += 1.5) {
        const x = rx + cos * s
        const y = ry + sin * s
        g.fillCircle(x, y, halfH)
      }
    }
    // Ring outline
    g.lineStyle(1.5, c.ring, 0.65); g.strokeCircle(rx, ry, 16)
    g.fillStyle(c.hue, 0.05); g.fillCircle(rx, ry, 16)
    // Rotor hub
    g.fillStyle(c.body2, 1); g.fillCircle(rx, ry, 4)
    g.lineStyle(1, 0xffffff, 0.4); g.strokeCircle(rx, ry, 4)
  }

  // ── Cockpit — radial-gradient sphere in the middle ────────────────────────
  // Outer glow
  g.fillStyle(c.cockpit2, 1); g.fillCircle(CX, CY, 13)
  // Mid tone
  g.fillStyle(c.cockpit1, 0.85); g.fillCircle(CX, CY, 10)
  // Bright highlight (top-left)
  g.fillStyle(0xffffff, 0.7); g.fillCircle(CX - 3, CY - 3, 4)
  g.fillStyle(0xffffff, 0.35); g.fillCircle(CX - 4, CY - 4, 2)
  // Cockpit rim
  g.lineStyle(1, 0xbfe9ff, 0.85); g.strokeCircle(CX, CY, 13)
}

// ─── Farm turret painter ──────────────────────────────────────────────────────
const TURRET_COLORS: Record<1 | 2 | 3, { accent: number, body: number, dark: number }> = {
  1: { accent: 0x00cc44, body: 0x2a3a2a, dark: 0x1a241a },
  2: { accent: 0xffaa00, body: 0x3a3010, dark: 0x221a00 },
  3: { accent: 0xff4400, body: 0x3a1a10, dark: 0x221008 },
}

export function paintFarmTurret(g: Phaser.GameObjects.Graphics, level: 1 | 2 | 3) {
  const col = TURRET_COLORS[level]

  // Base plate (ground mount)
  g.fillStyle(col.dark, 1)
  g.fillEllipse(64, 106, 84, 22)
  g.lineStyle(1.5, col.accent, 0.5)
  g.strokeEllipse(64, 106, 84, 22)

  // Body
  g.fillStyle(col.dark, 1)
  g.fillRect(36, 62, 56, 48)
  g.fillStyle(col.body, 1)
  g.fillRect(38, 60, 52, 48)

  // Armour seam lines
  g.lineStyle(1, col.accent, 0.25)
  g.lineBetween(38, 74, 90, 74)
  g.lineBetween(38, 88, 90, 88)
  g.lineBetween(38, 100, 90, 100)

  // Side armor plates
  g.fillStyle(col.dark, 1)
  g.fillRect(32, 66, 8, 36)
  g.fillRect(88, 66, 8, 36)
  g.lineStyle(1, col.accent, 0.2)
  g.lineBetween(32, 68, 40, 68)
  g.lineBetween(88, 68, 96, 68)

  // Turret head (dome)
  g.fillStyle(col.dark, 1)
  g.fillEllipse(64, 58, 52, 38)
  g.fillStyle(col.body, 1)
  g.fillEllipse(64, 56, 48, 34)

  // Barrel(s)
  if (level === 1) {
    // Single barrel
    g.fillStyle(col.dark, 1)
    g.fillRoundedRect(59, 8, 10, 44, 2)
    g.fillStyle(0x444444, 1)
    g.fillRoundedRect(61, 6, 6, 42, 2)
    g.lineStyle(1.5, col.accent, 0.6)
    g.strokeCircle(64, 10, 5)
  } else if (level === 2) {
    // Double barrel
    g.fillStyle(col.dark, 1)
    g.fillRoundedRect(52, 10, 8, 42, 2)
    g.fillRoundedRect(68, 10, 8, 42, 2)
    g.fillStyle(0x444444, 1)
    g.fillRoundedRect(54, 8, 4, 40, 1)
    g.fillRoundedRect(70, 8, 4, 40, 1)
    g.lineStyle(1.5, col.accent, 0.6)
    g.strokeCircle(56, 12, 4)
    g.strokeCircle(72, 12, 4)
  } else {
    // Triple barrel
    g.fillStyle(col.dark, 1)
    g.fillRoundedRect(43, 12, 7, 40, 2)
    g.fillRoundedRect(61, 8, 7, 44, 2)
    g.fillRoundedRect(78, 12, 7, 40, 2)
    g.fillStyle(0x444444, 1)
    g.fillRoundedRect(45, 10, 3, 38, 1)
    g.fillRoundedRect(63, 6, 3, 42, 1)
    g.fillRoundedRect(80, 10, 3, 38, 1)
    g.lineStyle(1.5, col.accent, 0.6)
    g.strokeCircle(47, 14, 3.5)
    g.strokeCircle(64, 10, 3.5)
    g.strokeCircle(81, 14, 3.5)
  }

  // Energy core
  g.fillStyle(col.accent, 0.85)
  g.fillCircle(64, 58, 8)
  g.fillStyle(col.accent, 0.35)
  g.fillCircle(64, 58, 14)
  g.fillStyle(0xffffff, 0.45)
  g.fillCircle(61, 55, 3)

  // Level pips (right side)
  g.fillStyle(col.accent, 1)
  for (let i = 0; i < level; i++) {
    g.fillCircle(93, 70 + i * 12, 3.5)
    g.fillStyle(col.accent, 0.3)
    g.fillCircle(93, 70 + i * 12, 6)
    g.fillStyle(col.accent, 1)
  }

  // Outline glow
  g.lineStyle(1.5, col.accent, 0.4)
  g.strokeRoundedRect(38, 60, 52, 48, 2)
}

// ─── Texture name helper ──────────────────────────────────────────────────────
export function getDroneTextureName(type: 1 | 2 | 3, broken: boolean): string {
  return broken ? `drone_${type}_broken` : `drone_${type}`
}

export function getFarmTurretTextureName(level: 1 | 2 | 3): string {
  return `farm_turret_${level}`
}
