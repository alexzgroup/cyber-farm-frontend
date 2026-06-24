interface IconProps { color: string; size?: number }

// ─── Drone: top-down X-frame quadcopter ──────────────────────────────────────
export function DroneIcon({ color, size = 28 }: IconProps) {
  const shadow = 'rgba(0,0,0,0.4)'
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" overflow="visible">
      {/* Diagonal arms */}
      <line x1="8"  y1="8"  x2="24" y2="24" stroke={color} strokeWidth="2.4" strokeLinecap="round"/>
      <line x1="24" y1="8"  x2="8"  y2="24" stroke={color} strokeWidth="2.4" strokeLinecap="round"/>

      {/* Propeller glow rings */}
      <circle cx="6"  cy="6"  r="4.5" fill={color} fillOpacity="0.18"/>
      <circle cx="26" cy="6"  r="4.5" fill={color} fillOpacity="0.18"/>
      <circle cx="6"  cy="26" r="4.5" fill={color} fillOpacity="0.18"/>
      <circle cx="26" cy="26" r="4.5" fill={color} fillOpacity="0.18"/>

      {/* Propeller discs */}
      <circle cx="6"  cy="6"  r="2.8" fill={color}/>
      <circle cx="26" cy="6"  r="2.8" fill={color}/>
      <circle cx="6"  cy="26" r="2.8" fill={color}/>
      <circle cx="26" cy="26" r="2.8" fill={color}/>

      {/* Propeller hubs */}
      <circle cx="6"  cy="6"  r="1.1" fill={shadow}/>
      <circle cx="26" cy="6"  r="1.1" fill={shadow}/>
      <circle cx="6"  cy="26" r="1.1" fill={shadow}/>
      <circle cx="26" cy="26" r="1.1" fill={shadow}/>

      {/* Body */}
      <circle cx="16" cy="16" r="6" fill={color}/>
      <circle cx="16" cy="16" r="3.5" fill={shadow}/>

      {/* Camera lens */}
      <circle cx="16" cy="16" r="1.6" fill={color} fillOpacity="0.65"/>
      <circle cx="14.8" cy="14.8" r="0.7" fill="white" fillOpacity="0.4"/>

      {/* Glow outline */}
      <circle cx="16" cy="16" r="6" stroke={color} strokeWidth="0.8" strokeOpacity="0.4" fill="none"/>
    </svg>
  )
}

// ─── Turret: front/side view, barrels vary by level ──────────────────────────
interface TurretIconProps extends IconProps { level: 1 | 2 | 3 }

export function TurretIcon({ color, level, size = 28 }: TurretIconProps) {
  const shadow = 'rgba(0,0,0,0.4)'

  // Barrel positions (x = left edge, y = top)
  const barrels =
    level === 1 ? [{ x: 14, y: 2, h: 12 }] :
    level === 2 ? [{ x: 10, y: 4, h: 10 }, { x: 18, y: 4, h: 10 }] :
                  [{ x: 6,  y: 5, h: 9  }, { x: 14, y: 2, h: 12 }, { x: 22, y: 5, h: 9 }]

  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none">
      {/* Barrels */}
      {barrels.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={b.y} width={4} height={b.h} rx="1.5" fill={color} fillOpacity="0.85"/>
          {/* Muzzle cap */}
          <rect x={b.x - 0.5} y={b.y} width={5} height="2.5" rx="1" fill={color}/>
        </g>
      ))}

      {/* Turret head/dome */}
      <rect x="7" y="14" width="18" height="9" rx="3" fill={color} fillOpacity="0.75"/>
      <rect x="9" y="15" width="14" height="5" rx="2" fill={color} fillOpacity="0.3"/>

      {/* Energy core */}
      <circle cx="16" cy="19" r="3.2" fill={color}/>
      <circle cx="16" cy="19" r="1.8" fill={shadow}/>
      <circle cx="15" cy="18" r="0.7" fill={color} fillOpacity="0.55"/>

      {/* Armoured body */}
      <rect x="5"  y="22" width="22" height="5" rx="2" fill={color} fillOpacity="0.55"/>
      {/* Base platform */}
      <rect x="2"  y="26" width="28" height="5" rx="1.5" fill={color} fillOpacity="0.3"/>

      {/* Glow outline on dome */}
      <rect x="7" y="14" width="18" height="9" rx="3" stroke={color} strokeWidth="0.7" strokeOpacity="0.5"/>
    </svg>
  )
}

// ─── Wrench (equipment / upgrades) ───────────────────────────────────────────
export function WrenchIcon({ color, size = 28 }: IconProps) {
  const shadow = 'rgba(0,0,0,0.5)'
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" overflow="visible">
      {/* Upright wrench rotated 45° CW: jaw opens upper-right, handle goes lower-left */}
      <g transform="rotate(45, 16, 16)">
        {/* Left jaw cheek */}
        <rect x="7"  y="4" width="7"  height="14" rx="3"  fill={color} fillOpacity="0.9"/>
        {/* Right jaw cheek */}
        <rect x="18" y="4" width="7"  height="14" rx="3"  fill={color} fillOpacity="0.9"/>
        {/* Solid body fill: seals the bottom so it looks like ONE head with a top notch, not a fork */}
        <rect x="7"  y="11" width="18" height="7"         fill={color} fillOpacity="0.9"/>
        {/* Handle */}
        <rect x="12" y="16" width="8"  height="14" rx="4" fill={color} fillOpacity="0.9"/>
        {/* Handle end cap */}
        <circle cx="16" cy="29" r="2.5" fill={shadow}/>
        {/* Shine */}
        <rect x="9" y="6" width="2" height="6" rx="1" fill="white" fillOpacity="0.2"/>
      </g>
    </svg>
  )
}

// ─── Circle wrapper ───────────────────────────────────────────────────────────
interface UnitCircleProps {
  color: string
  size?: number
  children: React.ReactNode
}

export function UnitCircle({ color, size = 48, children }: UnitCircleProps) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      background: `${color}1a`,
      border: `1.5px solid ${color}44`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      {children}
    </div>
  )
}
