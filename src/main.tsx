import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setupMockTelegram } from './telegram/mockEnv'
import { App } from './App'

// Inject mock Telegram WebApp when running outside Telegram (dev mode)
if (import.meta.env.DEV) {
  setupMockTelegram()
  // Expose store for Playwright/devtools testing
  import('./store/gameStore').then(({ useGameStore }) => {
    (window as any).__gameStore = useGameStore
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
