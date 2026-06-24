import QRCode from 'react-qr-code'

const MOBILE_PLATFORMS = new Set(['android', 'ios', 'android_x'])

function isMobilePlatform(): boolean {
  const platform: string = (window as any).Telegram?.WebApp?.platform ?? ''
  return MOBILE_PLATFORMS.has(platform)
}

function isAdmin(): boolean {
  const raw = import.meta.env.VITE_ADMIN_IDS ?? ''
  if (!raw) return false
  const id = String((window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id ?? '')
  return raw.split(',').map((s: string) => s.trim()).includes(id)
}

function getStartParam(): string | null {
  const url = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.slice(1))
  return url.get('startapp') ?? url.get('tgWebAppStartParam') ?? hash.get('tgWebAppStartParam') ?? null
}

export function MobileGuard({ children }: { children: React.ReactNode }) {
  if (isMobilePlatform() || isAdmin()) {
    return <>{children}</>
  }

  const botUrl = import.meta.env.VITE_BOT_URL ?? 'https://t.me/super_cyber_farm_bot'
  const startParam = getStartParam()
  const qrValue = startParam ? `${botUrl}?start=${startParam}` : botUrl

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0e1a 0%, #0d1f3c 100%)',
      fontFamily: 'system-ui, sans-serif',
      padding: 24,
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        maxWidth: 360,
        textAlign: 'center',
      }}>
        <img src="/favicon.svg" width={80} height={80} style={{ borderRadius: 18 }} alt="CyberFarm" />

        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#ffffff', letterSpacing: 1 }}>
            CyberFarm
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#8899aa' }}>
            Telegram Mini App
          </p>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: 16,
          padding: 16,
          boxShadow: '0 0 40px rgba(0,200,255,0.15)',
        }}>
          <QRCode
            value={qrValue}
            size={220}
            bgColor="#ffffff"
            fgColor="#0d1f3c"
          />
        </div>

        <div>
          <p style={{ margin: 0, fontSize: 16, color: '#ccddee', fontWeight: 500 }}>
            Available on mobile only
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#556677', lineHeight: 1.5 }}>
            Scan the QR code to open in Telegram{startParam ? ' (your invite link is included)' : ''}
          </p>
        </div>

        <div style={{
          background: 'rgba(0,200,255,0.08)',
          border: '1px solid rgba(0,200,255,0.2)',
          borderRadius: 8,
          padding: '8px 16px',
          color: '#00ccee',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: 0.5,
        }}>
          @SUPER_CYBER_FARM_BOT
        </div>
      </div>
    </div>
  )
}
