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

// ─── Main drone painter ───────────────────────────────────────────────────────
// The drone is rendered with layered "depth cake" so it reads as a volumetric
// unit even though everything is flat-shaded Phaser Graphics:
//   1) three-tier ground glow (outer aura → tight halo → dark shadow)
//   2) rotors behind (fill first, back-arms after)
//   3) two-tone belly then top hull, with a highlight stripe → gives roundness
//   4) rim outlines that follow the hull silhouette → cheap 3D edge lighting
//   5) cockpit dome with lens + reflection dot, glow ring around the cockpit
//   6) front rotors with hazy motion halo drawn on top of the body
export function paintDrone(
  g: Phaser.GameObjects.Graphics,
  broken: boolean,
  type: 1 | 2 | 3 = 1,
) {
  const c = broken ? BROKEN : PALETTES[type]

  const FLx = 22,  FLy = 24
  const FRx = 106, FRy = 24
  const BLx = 22,  BLy = 96
  const BRx = 106, BRy = 96
  const AFL = { x: 48, y: 52 }
  const AFR = { x: 80, y: 52 }
  const ABL = { x: 48, y: 68 }
  const ABR = { x: 80, y: 68 }

  // ── Tight ground shadow only — the wide glow disc under the drone reads as
  //     a UI circle, not a farm unit. Keep the hard shadow so drones still sit
  //     on the ground and don't feel like flat stickers.
  g.fillStyle(0x000000, 0.42)
  g.fillEllipse(66, 118, 68, 8)

  // ── Back rotors + arms (rendered first so they sit behind the hull) ────────
  paintProp(g, BLx, BLy, c.propBack, 0.55)
  paintProp(g, BRx, BRy, c.propBack, 0.55)
  g.lineStyle(8, c.bodyBot, 1)
  g.lineBetween(ABL.x, ABL.y, BLx, BLy)
  g.lineBetween(ABR.x, ABR.y, BRx, BRy)
  g.lineStyle(2, c.armHilit, 0.35)
  g.lineBetween(ABL.x, ABL.y - 2, BLx, BLy - 2)
  g.lineBetween(ABR.x, ABR.y - 2, BRx, BRy - 2)

  // ── Body: dark belly, main top, glossy highlight strip ─────────────────────
  // Belly (drop shadow layer)
  g.fillStyle(c.bodyBot, 1)
  g.fillRoundedRect(37, 60, 54, 22, 9)
  // Main hull
  g.fillStyle(c.bodyTop, 1)
  g.fillRoundedRect(38, 48, 52, 28, 10)
  // Top glossy strip — 3D roundness cue
  g.fillStyle(c.bodyHilit, 0.55)
  g.fillRoundedRect(40, 49, 48, 6, 6)
  g.fillStyle(0xffffff, 0.10)
  g.fillRoundedRect(42, 50, 44, 3, 3)
  // Bottom shadow crease
  g.fillStyle(0x000000, 0.20)
  g.fillRoundedRect(40, 72, 48, 4, 3)

  // ── Front arms with a metallic highlight ───────────────────────────────────
  g.lineStyle(8, c.armCol, 1)
  g.lineBetween(AFL.x, AFL.y, FLx, FLy)
  g.lineBetween(AFR.x, AFR.y, FRx, FRy)
  g.lineStyle(2, c.armHilit, 0.55)
  g.lineBetween(AFL.x, AFL.y - 2, FLx, FLy - 2)
  g.lineBetween(AFR.x, AFR.y - 2, FRx, FRy - 2)

  // ── Cockpit dome ───────────────────────────────────────────────────────────
  // Outer glow ring around the dome so the lens looks embedded, not flat
  if (!broken) {
    g.fillStyle(c.glow, 0.18)
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
  g.fillStyle(c.lens, 1)
  g.fillCircle(64, 59, 5)
  g.fillStyle(0x66aadd, 0.85)
  g.fillCircle(65, 58, 3)
  g.fillStyle(0xffffff, 0.7)
  g.fillCircle(63, 57, 1.5)

  // ── Front rotors on top of everything ──────────────────────────────────────
  paintProp(g, FLx, FLy, c.propFront, 1)
  paintProp(g, FRx, FRy, c.propFront, 1)

  // ── Nav LEDs ───────────────────────────────────────────────────────────────
  g.fillStyle(c.ledL, 1)
  g.fillCircle(40, 54, 3)
  g.fillStyle(c.ledL, 0.28)
  g.fillCircle(40, 54, 7)
  g.fillStyle(c.ledR, 1)
  g.fillCircle(88, 54, 3)
  g.fillStyle(c.ledR, 0.28)
  g.fillCircle(88, 54, 7)

  // Tail light
  g.fillStyle(broken ? 0x444444 : c.glow, 1)
  g.fillCircle(64, 71, 2)

  // ── Rim lights: cheap 3D edge cue ──────────────────────────────────────────
  if (!broken) {
    g.lineStyle(2, c.glow, 0.55)
    g.strokeRoundedRect(37, 47, 54, 28, 10)
    // no wide under-halo ring here — user asked for the round disc to go.
    g.lineStyle(1, c.bodyHilit, 0.35)
    g.strokeRoundedRect(38, 49, 52, 8, 6)
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
  // Wide motion halo (three tiers) so the rotor reads as spinning at speed.
  g.fillStyle(color, 0.05 * alpha)
  g.fillCircle(x, y, 24)
  g.fillStyle(color, 0.10 * alpha)
  g.fillCircle(x, y, 18)
  g.fillStyle(color, 0.22 * alpha)
  g.fillCircle(x, y, 12)
  // Motion-blur streak — thin bright ellipse across the rotor axis.
  g.fillStyle(color, 0.55 * alpha)
  g.fillEllipse(x, y, 24, 5)
  g.fillStyle(0xffffff, 0.20 * alpha)
  g.fillEllipse(x, y, 20, 2)
  // Hub itself
  g.fillStyle(0x001e2a, alpha)
  g.fillCircle(x, y, 8)
  g.lineStyle(1.5, 0x008899, alpha * 0.9)
  g.strokeCircle(x, y, 8)
  g.fillStyle(0x00aacc, alpha)
  g.fillCircle(x, y, 4)
  g.fillStyle(0xffffff, 0.75 * alpha)
  g.fillCircle(x, y, 1.5)
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
