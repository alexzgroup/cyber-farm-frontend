import type { AuthResponse } from './types'

const API_BASE      = import.meta.env.VITE_API_URL       ?? 'http://localhost:8080'
const DEV_BOT_TOKEN = import.meta.env.VITE_DEV_BOT_TOKEN ?? ''
const JWT_KEY       = 'cyberfarm_jwt'
const JWT_EXP_KEY   = 'cyberfarm_jwt_exp'

// ── Dev-mode detection ─────────────────────────────────────────────────────
// true when running in browser outside Telegram (initData is empty / missing)
const _tgInitData = typeof window !== 'undefined'
  ? (window as any).Telegram?.WebApp?.initData as string | undefined
  : undefined

export const devMode = !_tgInitData

// ── HMAC helpers ───────────────────────────────────────────────────────────
const enc = new TextEncoder()

async function hmacBytes(key: ArrayBuffer | ArrayBufferView, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  return crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data))
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ── Signed mock initData (dev only) ───────────────────────────────────────
// Generates a valid HMAC-SHA256 signed initData string exactly as Telegram
// would, so the backend's ValidateInitData passes in dev/test mode.
// Requires VITE_DEV_BOT_TOKEN to be set in .env.local
async function buildSignedInitData(): Promise<string> {
  const tgUser = {
    id:            123456789,
    first_name:    'Test',
    last_name:     'User',
    username:      'testuser',
    language_code: 'ru',
    is_premium:    false,
  }

  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id:  'AAHdF6IQAAAAAN0XohDhrOrc',
    user:      JSON.stringify(tgUser),
  }

  const dataCheckString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n')

  const secret    = await hmacBytes(enc.encode('WebAppData'), DEV_BOT_TOKEN)
  const hashBytes = await hmacBytes(new Uint8Array(secret), dataCheckString)
  const hash      = toHex(hashBytes)

  return new URLSearchParams({ ...fields, hash }).toString()
}

// ── JWT storage ────────────────────────────────────────────────────────────
let _jwt: string | null = null
let _jwtExp: number     = 0

function loadJwtFromStorage() {
  if (typeof window === 'undefined') return
  _jwt    = localStorage.getItem(JWT_KEY)
  _jwtExp = Number(localStorage.getItem(JWT_EXP_KEY) ?? 0)
}

function saveJwt(token: string, expiresIn: number) {
  _jwt    = token
  _jwtExp = Date.now() + expiresIn * 1000
  localStorage.setItem(JWT_KEY,     token)
  localStorage.setItem(JWT_EXP_KEY, String(_jwtExp))
}

function clearJwt() {
  _jwt    = null
  _jwtExp = 0
  localStorage.removeItem(JWT_KEY)
  localStorage.removeItem(JWT_EXP_KEY)
}

function isJwtFresh(): boolean {
  // valid if not expired and not expiring within the next 60 seconds
  return !!_jwt && Date.now() < _jwtExp - 60_000
}

loadJwtFromStorage()

// ── Authentication ─────────────────────────────────────────────────────────
let _authPromise: Promise<void> | null = null

async function authenticate(): Promise<void> {
  const initData = devMode
    ? await buildSignedInitData()
    : (_tgInitData ?? '')

  const res = await fetch(`${API_BASE}/api/auth/telegram`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ init_data: initData }),
  })

  if (!res.ok) throw new Error(`[CyberFarm] Auth failed: ${res.status}`)

  const data: AuthResponse = await res.json()
  saveJwt(data.token, data.expires_in)
}

async function ensureAuth(): Promise<void> {
  if (isJwtFresh()) return
  if (!_authPromise) {
    _authPromise = authenticate().finally(() => { _authPromise = null })
  }
  return _authPromise
}

// ── Token accessor (used by WebSocket client) ──────────────────────────────
export async function getAuthToken(): Promise<string> {
  await ensureAuth()
  return _jwt!
}

// ── Base fetch ─────────────────────────────────────────────────────────────
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  await ensureAuth()

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${_jwt!}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  })

  // Token rejected server-side — re-auth once and retry
  if (res.status === 401) {
    clearJwt()
    await authenticate()
    return apiFetch(path, init)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((body as any).error ?? `HTTP ${res.status}`)
  }

  return res.json() as Promise<T>
}
