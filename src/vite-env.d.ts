/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL:              string
  readonly VITE_WS_URL:               string
  readonly VITE_BOT_URL:              string
  readonly VITE_DEV_BOT_TOKEN:        string
  readonly VITE_TONCONNECT_MANIFEST_URL: string
  readonly VITE_ADMIN_IDS:            string
  readonly VITE_ENABLED_DESKTOP:      string
  readonly VITE_ADSGRAM_REWARD_GOLD_BLOCK_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
