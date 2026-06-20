import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// mode=tma  →  http://localhost:5174  (TMA-Studio, no SSL needed)
// default   →  https://localhost:5173 (Telegram prod, Playwright)
export default defineConfig(({ command, mode }) => {
  const isTma = mode === 'tma'

  return {
    base: '/',
    plugins: isTma ? [react()] : [react(), basicSsl()],
    server: {
      port: isTma ? 5174 : 5173,
      host: true,
      ...(isTma ? {} : { https: true }),
    },
    build: {
      target: 'esnext',
    },
    test: {
      globals:     true,
      environment: 'jsdom',
      setupFiles:  ['./src/__tests__/setup.ts'],
    },
  }
})
