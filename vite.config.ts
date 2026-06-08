import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/cyber-farm-frontend/' : '/',
  plugins: [react(), basicSsl()],
  server: {
    port: 5173,
    host: true,
    https: true,
  },
  build: {
    target: 'esnext',
  },
  test: {
    globals:     true,
    environment: 'jsdom',
    setupFiles:  ['./src/__tests__/setup.ts'],
  },
}))
