// Injects a minimal window.Telegram.WebApp mock so the app runs outside Telegram
export function setupMockTelegram() {
  if (typeof window === 'undefined') return
  if (window.Telegram?.WebApp) return

  const colorScheme = 'dark'

  const webApp = {
    initData: '',
    initDataUnsafe: {
      user: {
        id: 123456789,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        language_code: 'ru',
        is_premium: false,
      },
      start_param: '',
      auth_date: Math.floor(Date.now() / 1000),
      hash: 'mockhash',
    },
    version: '7.0',
    platform: 'unknown',
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
    requestWriteAccess: (cb?: (granted: boolean) => void) => cb?.(true),
    requestContact: (cb?: (sent: boolean) => void) => cb?.(true),
    showPopup: (params: object, cb?: (btn: string) => void) => cb?.('ok'),
    showScanQrPopup: () => {},
    closeScanQrPopup: () => {},
    readTextFromClipboard: (cb?: (text: string) => void) => cb?.(''),
    isVersionAtLeast: (v: string) => true,
  }

  ;(window as any).Telegram = { WebApp: webApp }
  console.log('[CyberFarm] Mock Telegram WebApp injected')
}
