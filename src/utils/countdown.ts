import { useEffect, useState } from 'react'

// Format a remaining-time delta into a compact HH:MM:SS / MM:SS string.
// Returns "" when target is already past. Pure helper so hooks can call it
// from an interval without a date-fns dependency.
export function formatCountdown(targetMs: number, nowMs: number = Date.now()): string {
  const delta = Math.max(0, Math.floor((targetMs - nowMs) / 1000))
  if (delta <= 0) return ''
  const h = Math.floor(delta / 3600)
  const m = Math.floor((delta % 3600) / 60)
  const s = delta % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

// Re-renders every second — for countdown UIs. One setInterval per component.
export function useNowSecond(): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}
