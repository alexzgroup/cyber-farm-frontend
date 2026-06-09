export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
}

export interface TelegramThemeParams {
  bg_color?: string
  text_color?: string
  hint_color?: string
  link_color?: string
  button_color?: string
  button_text_color?: string
  secondary_bg_color?: string
}

export interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    user?: TelegramUser
    start_param?: string
    auth_date: number
    hash: string
  }
  version: string
  platform: string
  colorScheme: 'dark' | 'light'
  themeParams: TelegramThemeParams
  isExpanded: boolean
  viewportHeight: number
  viewportStableHeight: number
  headerColor: string
  backgroundColor: string
  isClosingConfirmationEnabled: boolean
  BackButton: {
    isVisible: boolean
    show: () => void
    hide: () => void
    onClick: (fn: () => void) => void
    offClick: (fn: () => void) => void
  }
  MainButton: {
    text: string
    color: string
    textColor: string
    isVisible: boolean
    isActive: boolean
    show: () => void
    hide: () => void
    enable: () => void
    disable: () => void
    setText: (text: string) => void
    onClick: (fn: () => void) => void
    offClick: (fn: () => void) => void
  }
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
    selectionChanged: () => void
  }
  ready: () => void
  expand: () => void
  close: () => void
  sendData: (data: string) => void
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void
  openTelegramLink: (url: string) => void
  openInvoice: (url: string, callback: (status: string) => void) => void
  showAlert: (message: string, callback?: () => void) => void
  showConfirm: (message: string, callback?: (ok: boolean) => void) => void
  showPopup: (params: object, callback?: (btn: string) => void) => void
  setHeaderColor: (color: string) => void
  setBackgroundColor: (color: string) => void
  enableClosingConfirmation: () => void
  disableClosingConfirmation: () => void
  onEvent: (eventType: string, eventHandler: () => void) => void
  offEvent: (eventType: string, eventHandler: () => void) => void
  isVersionAtLeast: (version: string) => boolean
}

// Lazy getter — safe to call at any time; returns null if not inside Telegram.
// Never evaluated at module-load time so there's no crash on cold import.
export function getWebApp(): TelegramWebApp | null {
  return (window as { Telegram?: { WebApp?: TelegramWebApp } })?.Telegram?.WebApp ?? null
}

// Convenience re-export used by existing code (keeps old import paths working).
// Accessing this outside of Telegram returns null — always guard before calling methods.
export const webApp = new Proxy({} as TelegramWebApp, {
  get(_target, prop) {
    const app = getWebApp()
    if (!app) return undefined
    const val = (app as unknown as Record<string, unknown>)[prop as string]
    return typeof val === 'function' ? val.bind(app) : val
  },
})

export function initTelegramApp(): void {
  const app = getWebApp()
  if (!app) {
    // Running outside Telegram (browser dev, Playwright) — skip silently
    return
  }
  try {
    app.ready()
    app.expand()
    if (app.isVersionAtLeast('6.1')) {
      app.setHeaderColor('#0d1117')
      app.setBackgroundColor('#0d1117')
    }
  } catch (e) {
    console.warn('[TelegramWebApp] init error:', e)
  }
}
