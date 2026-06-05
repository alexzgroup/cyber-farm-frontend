/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV:          string
  readonly VITE_API_URL:          string
  readonly VITE_DEV_API_KEY:      string
  readonly VITE_DEV_BOT_TOKEN:    string
  readonly VITE_BOT_USERNAME:     string
  readonly VITE_TON_MANIFEST_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
