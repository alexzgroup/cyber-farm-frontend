// Injects a minimal window.Telegram.WebApp mock so the app runs outside Telegram
export function setupMockTelegram() {
  if (typeof window === 'undefined') return

  const colorScheme = 'dark'

  const webApp = {
    initData: '',
    initDataUnsafe: {
      user: (() => {
        const urlId = Number(new URLSearchParams(window.location.search).get('dev_user_id') ?? '') || 0
        return urlId
          ? { id: urlId, first_name: `User${urlId}`, last_name: '', username: `dev_user_${urlId}`, language_code: 'ru', is_premium: false }
          : { id: 123456789, first_name: 'Test', last_name: 'User', username: 'testuser', language_code: 'ru', is_premium: false }
      })(),
      start_param: '',
      auth_date: Math.floor(Date.now() / 1000),
      hash: 'mockhash',
    },
    version: '7.0',
    platform: 'android',
    colorScheme,
    themeParams: {
      bg_color: '#0d1117',
      text_color: '#c9d1d9',
      hint_color: '#8b949e',
      link_color: '#58a6ff',
      button_color: '#238636',
      button_text_color: '#ffffff',
      secondary_bg_color: '#161b22',
    },
    isExpanded: true,
    viewportHeight: window.innerHeight,
    viewportStableHeight: window.innerHeight,
    headerColor: '#0d1117',
    backgroundColor: '#0d1117',
    isClosingConfirmationEnabled: false,
    BackButton: { isVisible: false, onClick: () => {}, offClick: () => {}, show: () => {}, hide: () => {} },
    MainButton: {
      text: '', color: '#238636', textColor: '#ffffff', isVisible: false, isActive: true, isProgressVisible: false,
      onClick: () => {}, offClick: () => {}, show: () => {}, hide: () => {}, enable: () => {}, disable: () => {},
      showProgress: () => {}, hideProgress: () => {}, setText: () => {}, setParams: () => {},
    },
    HapticFeedback: {
      impactOccurred: () => {},
      notificationOccurred: () => {},
      selectionChanged: () => {},
    },
    ready: () => {},
    expand: () => {},
    close: () => {},
    sendData: (data: string) => console.log('[MockTG] sendData:', data),
    openLink: (url: string) => window.open(url, '_blank'),
    openTelegramLink: (url: string) => console.log('[MockTG] openTelegramLink:', url),
    showAlert: (msg: string, cb?: () => void) => { alert(msg); cb?.() },
    showConfirm: (msg: string, cb?: (ok: boolean) => void) => { cb?.(confirm(msg)) },
    onEvent: (event: string, handler: () => void) => {},
    offEvent: (event: string, handler: () => void) => {},
    setHeaderColor: (color: string) => {},
    setBackgroundColor: (color: string) => {},
    enableClosingConfirmation: () => {},
    disableClosingConfirmation: () => {},
    // Mock the native permission dialog with a browser confirm() so the
    // dev environment makes the choice visible. Allows testing both branches
    // of the opt-in flow (granted vs. cancelled) without a real Telegram client.
    requestWriteAccess: (cb?: (granted: boolean) => void) => {
      const granted = window.confirm(
        '[Mock Telegram]\n\nAllow this bot to send you messages?',
      )
      cb?.(granted)
    },
    requestContact: (cb?: (sent: boolean) => void) => cb?.(true),
    showPopup: (params: object, cb?: (btn: string) => void) => cb?.('ok'),
    showScanQrPopup: () => {},
    closeScanQrPopup: () => {},
    readTextFromClipboard: (cb?: (text: string) => void) => cb?.(''),
    isVersionAtLeast: (v: string) => true,
    sendPreparedMessage: (msg: { id: string }, cb?: (sent: boolean) => void) => {
      console.log('[MockTG] sendPreparedMessage:', msg)
      cb?.(true)
    },
  }

  ;(window as any).Telegram = { WebApp: webApp }
  console.log('[CyberFarm] Mock Telegram WebApp injected')
}
