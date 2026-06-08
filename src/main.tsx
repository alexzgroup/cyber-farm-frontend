import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setupMockTelegram } from './telegram/mockEnv'
import { initTelegramApp } from './telegram/webApp'
import './i18n'   // initialise i18next before rendering
import { App } from './App'

if (import.meta.env.DEV) {
  setupMockTelegram()
  import('./store/gameStore').then(({ useGameStore }) => {
    (window as any).__gameStore = useGameStore
  })
}

initTelegramApp()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
