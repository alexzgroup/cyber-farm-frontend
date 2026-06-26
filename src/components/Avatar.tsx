import { useState } from 'react'

const PALETTE = [
  '#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#ef4444', '#14b8a6', '#a855f7',
  '#22d3ee', '#84cc16',
]

function pickColor(seed: number): string {
  return PALETTE[Math.abs(seed) % PALETTE.length]
}

function initials(firstName?: string, lastName?: string, username?: string): string {
  const a = (firstName ?? '').trim()
  const b = (lastName ?? '').trim()
  if (a || b) return ((a[0] ?? '') + (b[0] ?? '')).toUpperCase() || '?'
  const u = (username ?? '').trim().replace(/^@/, '')
  return (u[0] ?? '?').toUpperCase()
}

interface Props {
  url?:       string
  firstName?: string
  lastName?:  string
  username?:  string
  userId?:    number
  size?:      number
  style?:     React.CSSProperties
}

export function Avatar({ url, firstName, lastName, username, userId, size = 36, style }: Props) {
  const [failed, setFailed] = useState(false)
  const bg     = pickColor(userId ?? (firstName?.charCodeAt(0) ?? 0))
  const showImg = url && !failed

  const base: React.CSSProperties = {
    width: size, height: size, borderRadius: '50%',
    flexShrink: 0, overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.42, fontWeight: 700, color: '#fff',
    background: bg, userSelect: 'none',
    ...style,
  }

  if (showImg) {
    return (
      <img
        src={url}
        alt=""
        style={base}
        onError={() => setFailed(true)}
      />
    )
  }
  return <div style={base}>{initials(firstName, lastName, username)}</div>
}
