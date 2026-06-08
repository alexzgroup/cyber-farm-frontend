import { useState, useEffect, useRef } from 'react'

/** Returns remaining seconds (0 when expired), refreshes every second. */
export function useCountdown(untilUnix: number | null | undefined): number {
  const getRemaining = () =>
    untilUnix ? Math.max(0, Math.ceil(untilUnix - Date.now() / 1000)) : 0

  const [remaining, setRemaining] = useState(getRemaining)
  const ref = useRef(untilUnix)
  ref.current = untilUnix

  useEffect(() => {
    if (!untilUnix || getRemaining() === 0) { setRemaining(0); return }
    setRemaining(getRemaining())
    const id = setInterval(() => {
      const r = Math.max(0, Math.ceil((ref.current ?? 0) - Date.now() / 1000))
      setRemaining(r)
      if (r === 0) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [untilUnix])

  return remaining
}

/** Format seconds as "59:30" or "1ч 2м" */
export function fmtCooldown(seconds: number): string {
  if (seconds <= 0) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}ч ${m}м`
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`
  return `0:${String(s).padStart(2, '0')}`
}
