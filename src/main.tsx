import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { setupMockTelegram } from './telegram/mockEnv'
import { initTelegramApp } from './telegram/webApp'
import './i18n'   // initialise i18next before rendering
import { App } from './App'
import { MobileGuard } from './components/MobileGuard'

if (import.meta.env.DEV) {
  setupMockTelegram()
  import('./store/gameStore').then(({ useGameStore }) => {
    (window as any).__gameStore = useGameStore
  })
}

initTelegramApp()

// TON Connect manifest: prefer explicit env var, fall back to same-origin path.
// In production set VITE_TONCONNECT_MANIFEST_URL to your Mini App URL + /tonconnect-manifest.json
const manifestUrl =
  import.meta.env.VITE_TONCONNECT_MANIFEST_URL ||
  `${window.location.origin}/tonconnect-manifest.json`

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <MobileGuard>
        <App />
      </MobileGuard>
    </TonConnectUIProvider>
  </StrictMode>
)
