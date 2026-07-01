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
