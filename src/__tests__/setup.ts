import '@testing-library/jest-dom'

// Stub crypto.subtle (used by apiFetch HMAC) in jsdom
const mockCrypto = {
  subtle: {
    importKey: vi.fn().mockResolvedValue('mock-key'),
    sign:      vi.fn().mockResolvedValue(new Uint8Array([0x01, 0x02]).buffer),
  },
  getRandomValues: (arr: Uint8Array) => { arr.fill(1); return arr },
}
Object.defineProperty(globalThis, 'crypto', { value: mockCrypto, writable: true })

// Stub localStorage
const storage: Record<string, string> = {}
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem:    (k: string) => storage[k] ?? null,
    setItem:    (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
    clear:      () => { Object.keys(storage).forEach((k) => delete storage[k]) },
  },
  writable: true,
})

// Stub Telegram WebApp (no initData → devMode = true)
Object.defineProperty(globalThis, 'window', {
  value: { Telegram: { WebApp: { initData: '' } } },
  writable: true,
})

// Reset Zustand stores between tests
beforeEach(() => {
  localStorage.clear()
})
