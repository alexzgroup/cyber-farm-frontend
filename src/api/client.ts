import type { AuthResponse } from './types'

const API_BASE    = import.meta.env.VITE_API_URL      ?? 'http://localhost:8080'
const DEV_API_KEY = import.meta.env.VITE_DEV_API_KEY  ?? ''
const DEV_BOT_TOKEN = import.meta.env.VITE_DEV_BOT_TOKEN ?? ''
const JWT_KEY     = 'cyberfarm_jwt'

// ── devMode detection ──────────────────────────────────────────────────────
// true when app is opened in browser outside Telegram (initData is empty)
const _tgInitData = typeof window !== 'undefined'
  ? (window as any).Telegram?.WebApp?.initData as string | undefined
  : undefined

export const devMode = !_tgInitData

// ── Helpers ────────────────────────────────────────────────────────────────
const enc = new TextEncoder()

async function hmacBytes(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key,
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  )
  return crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data))
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ── Signed Telegram initData ───────────────────────────────────────────────
// Generates a properly HMAC-SHA256 signed initData string identical to what
// the real Telegram client sends, so the backend's ValidateInitData passes.
//
// Algorithm (per Telegram docs):
//   secret = HMAC-SHA256(key="WebAppData", data=bot_token)
//   hash   = HMAC-SHA256(key=secret, data=sorted_fields joined by \n)
async function buildSignedInitData(): Promise<string> {
  const user = {
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
    user:      JSON.stringify(user),
  }

  const dataCheckString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n')

  const secret    = await hmacBytes(enc.encode('WebAppData'), DEV_BOT_TOKEN)
  const hashBytes = await hmacBytes(secret, dataCheckString)
  const hash      = toHex(hashBytes)

  return new URLSearchParams({ ...fields, hash }).toString()
}

// ── x-api-key ──────────────────────────────────────────────────────────────
// Format: `{base64url(payload)}.{HMAC-SHA256(payload, DEV_API_KEY)}`
// Payload: JSON { user: {...}, ts: unix_seconds }
// Backend decodes the payload, verifies HMAC, then initializes the user from it.
async function buildXApiKey(): Promise<string> {
  const tgUser = devMode
    ? null
    : (window as any).Telegram?.WebApp?.initDataUnsafe?.user

  const user = tgUser ?? {
    id:            123456789,
    first_name:    'Test',
    last_name:     'User',
    username:      'testuser',
    language_code: 'ru',
    is_premium:    false,
  }

  const payload = JSON.stringify({ user, ts: Math.floor(Date.now() / 1000) })
  const b64     = btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const sig     = toHex(await hmacBytes(enc.encode(DEV_API_KEY), b64))
  return `${b64}.${sig}`
}

// ── JWT management ─────────────────────────────────────────────────────────
let _jwt: string | null = typeof window !== 'undefined'
  ? localStorage.getItem(JWT_KEY)
  : null

function setJwt(token: string) {
  _jwt = token
  localStorage.setItem(JWT_KEY, token)
}

function clearJwt() {
  _jwt = null
  localStorage.removeItem(JWT_KEY)
}

// ── Authentication ─────────────────────────────────────────────────────────
let _authPromise: Promise<void> | null = null

async function authenticate(): Promise<void> {
  const initData = devMode
    ? await buildSignedInitData()
    : (_tgInitData ?? '')

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (DEV_API_KEY) {
    headers['x-api-key'] = await buildXApiKey()
  }

  const res = await fetch(`${API_BASE}/api/auth/telegram`, {
    method:  'POST',
    headers,
    body:    JSON.stringify({ init_data: initData }),
  })

  if (!res.ok) {
    throw new Error(`[CyberFarm] Auth failed: ${res.status}`)
  }

  const data: AuthResponse = await res.json()
  setJwt(data.token)
}

async function ensureAuth(): Promise<void> {
  if (_jwt) return
  if (!_authPromise) {
    _authPromise = authenticate().finally(() => { _authPromise = null })
  }
  return _authPromise
}

// ── Base fetch ─────────────────────────────────────────────────────────────
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  await ensureAuth()

  const headers: Record<string, string> = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${_jwt!}`,
    ...(init.headers as Record<string, string> | undefined),
  }

  if (DEV_API_KEY) {
    headers['x-api-key'] = await buildXApiKey()
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })

  // Token expired — re-auth once and retry
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
