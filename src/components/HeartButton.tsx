interface Props {
  active:  boolean
  onClick: () => void
  size?:   number
  title?:  string
}

/**
 * Cyber-styled heart toggle button — used to add/remove a player from favorites.
 * Active state: neon pink fill with cyan glow.
 * Inactive state: outline only, hovers to bright cyan.
 */
export function HeartButton({ active, onClick, size = 28, title }: Props) {
  const color = active ? '#ff3d7f' : '#475569'
  const fill  = active ? '#ff3d7f' : 'none'
  const glow  = active ? '0 0 8px rgba(255,61,127,0.6), 0 0 14px rgba(0,229,255,0.3)' : 'none'

  return (
    <button
      type="button"
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      style={{
        width: size, height: size,
        background: active ? 'rgba(255,61,127,0.08)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? 'rgba(255,61,127,0.4)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 8,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: glow,
        transition: 'all 0.15s',
        flexShrink: 0,
        padding: 0,
      }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    </button>
  )
}
