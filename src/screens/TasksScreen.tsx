import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { getAdsgramStatus } from '../api'

const ADSGRAM_BLOCK_ID = import.meta.env.VITE_ADSGRAM_REWARD_GOLD_BLOCK_ID ?? ''

type AdsgramController = {
  show(): Promise<{ done: boolean; description: string; state: string; error: boolean }>
}

declare global {
  interface Window {
    Adsgram?: {
      init(opts: { blockId: string }): AdsgramController
    }
  }
}

function formatLeft(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function TasksScreen() {
  const { t } = useTranslation()
  const setScreen = useGameStore((s) => s.setScreen)

  const [nextAt, setNextAt] = useState<number>(0)
  const [reward, setReward] = useState<number>(50)
  // Cooldown between ad rewards — driven by the `adsgram_cooldown_sec` setting
  // in CRM, delivered on every status poll. Displayed in the label under the
  // watch button; hardcoding lied to users when admins changed the setting.
  const [cooldownSec, setCooldownSec] = useState<number>(300)
  const [now, setNow] = useState<number>(Math.floor(Date.now() / 1000))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const adRef = useRef<AdsgramController | null>(null)

  const loadStatus = () => {
    getAdsgramStatus()
      .then((s) => {
        setNextAt(s.next_at)
        setReward(s.reward)
        if (s.cooldown_sec > 0) setCooldownSec(s.cooldown_sec)
      })
      .catch(() => {/* silent */})
  }

  useEffect(() => {
    loadStatus()
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(t)
  }, [])

  const secLeft = Math.max(0, nextAt - now)
  const onCooldown = secLeft > 0
  const sdkReady = typeof window !== 'undefined' && !!window.Adsgram && !!ADSGRAM_BLOCK_ID

  const handleWatch = async () => {
    if (busy || onCooldown) return
    setError(null)
    setBusy(true)

    try {
      if (!adRef.current) {
        if (!window.Adsgram) throw new Error('SDK_NOT_LOADED')
        if (!ADSGRAM_BLOCK_ID) throw new Error('SDK_NOT_LOADED')
        adRef.current = window.Adsgram.init({ blockId: ADSGRAM_BLOCK_ID })
      }
      const result = await adRef.current.show()
      // Backend will credit the gold via server-to-server callback;
      // the WS farm.push event triggers loadGameState in api/websocket.ts.
      // We just refresh the cooldown timer here.
      if (result.done) {
        setTimeout(loadStatus, 1500)
      } else {
        setError(t('tasks.adNotFinished'))
      }
    } catch (e) {
      const code = (e as Error).message || ''
      setError(code === 'SDK_NOT_LOADED' ? t('tasks.sdkError') : t('tasks.adError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: '#0d1117', color: '#e2e8f0', padding: '16px 16px 24px' }}>
      <style>{`
        @keyframes earnPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(246,197,68,0.55); }
          50%      { transform: scale(1.03); box-shadow: 0 0 0 12px rgba(246,197,68,0); }
        }
        @keyframes goldShimmer {
          0%   { background-position:   0% 50%; }
          100% { background-position: 200% 50%; }
        }
        .tasks-watch-btn:disabled { opacity: 0.55; cursor: not-allowed; animation: none; }
      `}</style>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button
          onClick={() => setScreen('profile')}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#e2e8f0', borderRadius: 10, padding: '6px 12px', fontSize: 13, cursor: 'pointer',
          }}
        >
          {t('common.back')}
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: 0.5 }}>{t('tasks.title')}</h1>
      </div>

      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 14 }}>
        {t('tasks.subtitle')}
      </div>

      {/* Task card */}
      <section
        style={{
          background: 'linear-gradient(135deg, rgba(246,197,68,0.10), rgba(124,58,237,0.10))',
          border: '1px solid rgba(246,197,68,0.35)',
          borderRadius: 16, padding: 18,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'rgba(246,197,68,0.18)',
            border: '1px solid rgba(246,197,68,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
          }}>
            🎬
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#fde68a' }}>
              {t('tasks.gold50Title', { amount: reward })}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>
              {t('tasks.gold50Sub')}
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          className="tasks-watch-btn"
          onClick={handleWatch}
          disabled={busy || onCooldown || !sdkReady}
          style={{
            width: '100%', padding: '14px 16px', borderRadius: 12,
            border: '1px solid rgba(246,197,68,0.6)',
            background: onCooldown
              ? 'rgba(255,255,255,0.06)'
              : 'linear-gradient(90deg, #f6c544, #ffb302, #f6c544)',
            backgroundSize: '200% 100%',
            color: onCooldown ? 'rgba(255,255,255,0.55)' : '#1a1300',
            fontWeight: 800, fontSize: 15, cursor: 'pointer',
            animation: onCooldown || busy ? 'none' : 'earnPulse 2s ease-in-out infinite, goldShimmer 3s linear infinite',
          }}
        >
          {busy
            ? t('tasks.loadingAd')
            : onCooldown
            ? t('tasks.availableIn', { time: formatLeft(secLeft) })
            : t('tasks.watchAd', { amount: reward })}
        </button>

        {error && (
          <div style={{ fontSize: 12, color: '#f87171', textAlign: 'center' }}>{error}</div>
        )}

        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
          {t('tasks.cooldownHint', { minutes: Math.max(1, Math.round(cooldownSec / 60)) })}
        </div>
      </section>
    </div>
  )
}
