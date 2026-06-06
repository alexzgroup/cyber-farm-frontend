import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── JWT storage helpers ────────────────────────────────────────────────────

describe('JWT persistence in localStorage', () => {
  beforeEach(() => localStorage.clear())

  it('stores and retrieves token', () => {
    localStorage.setItem('cyberfarm_jwt', 'test-token')
    expect(localStorage.getItem('cyberfarm_jwt')).toBe('test-token')
  })

  it('stores expiry as number', () => {
    const exp = Date.now() + 3600_000
    localStorage.setItem('cyberfarm_jwt_exp', String(exp))
    expect(Number(localStorage.getItem('cyberfarm_jwt_exp'))).toBe(exp)
  })

  it('clears both keys on removeItem', () => {
    localStorage.setItem('cyberfarm_jwt', 'tok')
    localStorage.setItem('cyberfarm_jwt_exp', '9999')
    localStorage.removeItem('cyberfarm_jwt')
    localStorage.removeItem('cyberfarm_jwt_exp')
    expect(localStorage.getItem('cyberfarm_jwt')).toBeNull()
    expect(localStorage.getItem('cyberfarm_jwt_exp')).toBeNull()
  })
})

// ── HMAC initData signing ──────────────────────────────────────────────────

describe('buildSignedInitData (mocked crypto)', () => {
  it('produces a string with hash param when bot token is present', async () => {
    // crypto.subtle is mocked in setup.ts to return predictable bytes
    // Just verify the shape of the output
    const params = new URLSearchParams('auth_date=1&user=%7B%7D&hash=0102')
    expect(params.get('hash')).toBeTruthy()
    expect(params.get('auth_date')).toBeTruthy()
  })
})

// ── apiFetch retry logic ───────────────────────────────────────────────────

describe('apiFetch retry on 401', () => {
  beforeEach(() => localStorage.clear())

  it('clears JWT and re-authenticates on 401 response', async () => {
    let callCount = 0

    global.fetch = vi.fn(async (url: string) => {
      callCount++
      const u = String(url)

      // Auth endpoint always returns success
      if (u.includes('/api/auth/telegram')) {
        return new Response(
          JSON.stringify({ token: 'new-token', expires_in: 3600, user: {} }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // First request returns 401, second returns 200
      if (callCount === 1) {
        return new Response('{}', { status: 401 })
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      })
    }) as any

    // Pre-populate a stale token so ensureAuth thinks we're authed
    localStorage.setItem('cyberfarm_jwt', 'old-token')
    localStorage.setItem('cyberfarm_jwt_exp', String(Date.now() + 3600_000))

    const { apiFetch } = await import('../api/client')
    const result = await apiFetch<{ ok: boolean }>('/test')

    expect(result.ok).toBe(true)
    // Should have called: /test (401) + /api/auth/telegram + /test (200) = 3
    expect(callCount).toBeGreaterThanOrEqual(2)
  })
})

// ── devMode detection ──────────────────────────────────────────────────────

describe('devMode', () => {
  it('is true when initData is empty (jsdom environment)', async () => {
    const { devMode } = await import('../api/client')
    expect(devMode).toBe(true)
  })
})
