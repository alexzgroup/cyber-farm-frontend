import type { AuthResponse } from './types'

const API_BASE      = import.meta.env.VITE_API_URL       ?? 'http://localhost:8080'
const DEV_BOT_TOKEN = import.meta.env.VITE_DEV_BOT_TOKEN ?? ''
const _devUserId    = typeof window !== 'undefined'
  ? (new URLSearchParams(window.location.search).get('dev_user_id') ?? '')
  : ''
const JWT_KEY       = _devUserId ? `cyberfarm_jwt_${_devUserId}` : 'cyberfarm_jwt'
const JWT_EXP_KEY   = _devUserId ? `cyberfarm_jwt_exp_${_devUserId}` : 'cyberfarm_jwt_exp'
const TG_UID_KEY    = 'cyberfarm_tg_uid'

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
// Supports ?dev_user_id=N URL param to test multi-user scenarios.
async function buildSignedInitData(): Promise<string> {
  const urlUserId = typeof window !== 'undefined'
    ? Number(new URLSearchParams(window.location.search).get('dev_user_id') ?? '') || 0
    : 0
  const tgUser = {
    id:            urlUserId || 123456789,
    first_name:    urlUserId ? `User${urlUserId}` : 'Test',
    last_name:     urlUserId ? '' : 'User',
    username:      urlUserId ? `dev_user_${urlUserId}` : 'testuser',
    language_code: 'ru',
    is_premium:    false,
  }

  const urlRef = typeof window !== 'undefined'
    ? (new URLSearchParams(window.location.search).get('ref') ?? '')
    : ''

  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id:  'AAHdF6IQAAAAAN0XohDhrOrc',
    user:      JSON.stringify(tgUser),
    ...(urlRef ? { start_param: `ref_${urlRef}` } : {}),
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

// ── Telegram user ID (known before auth, from initDataUnsafe) ─────────────
function getCurrentTgId(): number {
  if (devMode) return _devUserId ? Number(_devUserId) : 123456789
  return (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id ?? 0
}

// ── JWT storage ────────────────────────────────────────────────────────────
let _jwt: string | null = null
let _jwtExp: number     = 0

function loadJwtFromStorage() {
  if (typeof window === 'undefined') return
  // If a different Telegram account opened the app on this device — wipe the old token
  const storedTgId  = Number(localStorage.getItem(TG_UID_KEY) ?? 0)
  const currentTgId = getCurrentTgId()
  if (storedTgId && currentTgId && storedTgId !== currentTgId) {
    localStorage.removeItem(JWT_KEY)
    localStorage.removeItem(JWT_EXP_KEY)
    localStorage.removeItem(TG_UID_KEY)
    console.log('[CyberFarm] Telegram account changed — cleared stored token')
    return
  }
  _jwt    = localStorage.getItem(JWT_KEY)
  _jwtExp = Number(localStorage.getItem(JWT_EXP_KEY) ?? 0)
}

function saveJwt(token: string, expiresIn: number) {
  _jwt    = token
  _jwtExp = Date.now() + expiresIn * 1000
  localStorage.setItem(JWT_KEY,     token)
  localStorage.setItem(JWT_EXP_KEY, String(_jwtExp))
  localStorage.setItem(TG_UID_KEY,  String(getCurrentTgId()))
}

function clearJwt() {
  _jwt    = null
  _jwtExp = 0
  localStorage.removeItem(JWT_KEY)
  localStorage.removeItem(JWT_EXP_KEY)
  localStorage.removeItem(TG_UID_KEY)
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

  const urlStartParam = new URLSearchParams(window.location.search).get('startapp') ?? ''

  const res = await fetch(`${API_BASE}/api/auth/telegram`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ init_data: initData, ...(urlStartParam ? { start_param: urlStartParam } : {}) }),
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
    const err: any = new Error((body as any).error ?? `HTTP ${res.status}`)
    err.status = res.status
    err.data   = body
    throw err
  }

  return res.json() as Promise<T>
}
