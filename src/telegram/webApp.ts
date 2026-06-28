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
  // Bot API 7.2+: asks the user for permission to receive messages from the bot.
  // Mock and older Telegram clients may not have it — always probe with optional chaining.
  requestWriteAccess?: (callback?: (accessGranted: boolean) => void) => void
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

// Asks the Telegram client to show the native "allow this bot to message you"
// dialog. Uses the modern SDK 2.x Promise-based API when available (works in
// real Telegram on Bot API 6.9+), and falls back to the raw WebApp.requestWriteAccess
// callback for older clients. In dev / outside Telegram returns true so the UI
// flow can proceed.
//
// Note: Telegram only shows the dialog when the user has NOT yet granted write
// access (i.e. they have not started a chat with the bot via /start or have
// blocked it). For anyone who already pressed /start the SDK resolves to
// 'allowed' immediately with no popup — that's by design on the Telegram side.
export async function requestBotWriteAccess(): Promise<boolean> {
  // 1) Modern SDK path. Throws ERR_NOT_SUPPORTED when client is too old; we
  //    catch and fall through to legacy.
  try {
    const sdk = await import('@telegram-apps/sdk')
    if (sdk.requestWriteAccess?.isAvailable?.()) {
      const status = await sdk.requestWriteAccess()
      console.log('[CyberFarm] requestWriteAccess (sdk) status:', status)
      return status === 'allowed'
    }
  } catch (err) {
    console.warn('[CyberFarm] requestWriteAccess (sdk) failed, falling back', err)
  }

  // 2) Legacy raw WebApp API.
  const app = getWebApp()
  if (!app?.requestWriteAccess) {
    console.log('[CyberFarm] requestWriteAccess: no Telegram WebApp available — granting locally')
    return true
  }
  return new Promise<boolean>((resolve) => {
    try {
      app.requestWriteAccess!((granted) => {
        console.log('[CyberFarm] requestWriteAccess (legacy) granted:', granted)
        resolve(Boolean(granted))
      })
    } catch (err) {
      console.warn('[CyberFarm] requestWriteAccess (legacy) threw', err)
      resolve(false)
    }
  })
}

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
  // SDK 2.x: initialise the event bridge so utilities like requestWriteAccess
  // can fire postEvent calls. Lazy-imported to avoid pulling the bridge into
  // the dev build when we're not in Telegram.
  import('@telegram-apps/sdk').then((sdk) => {
    try { sdk.init() } catch (e) { console.warn('[TelegramWebApp] sdk init error:', e) }
  }).catch(() => {/* no-op */})
}
