import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { prepareReferralMessage } from '../api'
import { HowToEarnTonModal } from './HowToEarnTonModal'

interface Props {
  /** Текст основной кнопки. По умолчанию — referrals.inviteEarnTon */
  label?: string
  /** Стиль контейнера */
  style?: React.CSSProperties
  /** Реферальная ссылка пользователя (опц.) — используется в t.me/share fallback */
  refLink?: string
}

/**
 * Универсальная кнопка «Пригласи друга и заработай TON».
 * - Открывает Telegram share-sheet (prepareReferralMessage → sendPreparedMessage)
 * - Fallback: открывает t.me/share/url через openTelegramLink или просто копирует ссылку
 * - Иконка «?» рядом — открывает HowToEarnTonModal с условиями
 */
export function InviteFriendButton({ label, style, refLink }: Props) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const tgWebApp = (window as any).Telegram?.WebApp

  const shareViaLink = () => {
    if (!refLink) return
    const text = t('profile.inviteDesc')
    if (tgWebApp?.openTelegramLink) {
      tgWebApp.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(text)}`,
      )
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(refLink)
    }
  }

  const handleClick = async () => {
    if (loading) return
    setLoading(true)
    try {
      const prepared = await prepareReferralMessage()
      const tg = (window as any).Telegram?.WebApp
      if (tg?.sendPreparedMessage) {
        tg.sendPreparedMessage({ id: prepared.id })
      } else {
        ;(window as any).TelegramWebviewProxy?.postEvent(
          'web_app_send_prepared_message',
          JSON.stringify({ id: prepared.id }),
        )
      }
    } catch {
      shareViaLink()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, ...(style ?? {}) }}>
      <button style={s.mainBtn} onClick={handleClick} disabled={loading}>
        🎁 {label ?? t('referrals.inviteEarnTon')}
      </button>
      <button
        style={s.infoBtn}
        onClick={() => setModalOpen(true)}
        aria-label={t('referrals.howToEarn')}
        title={t('referrals.howToEarn')}
      >
        ?
      </button>
      <HowToEarnTonModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  mainBtn: {
    flex: 1, padding: '12px 14px', borderRadius: 12,
    background: 'linear-gradient(135deg, rgba(56,189,248,0.22), rgba(168,85,247,0.18))',
    border: '1px solid rgba(56,189,248,0.4)',
    color: '#e0f2fe', fontSize: 13, fontWeight: 800, cursor: 'pointer',
    fontFamily: 'monospace', letterSpacing: 0.3,
    boxShadow: '0 0 12px rgba(56,189,248,0.15)',
  },
  infoBtn: {
    width: 40, padding: '12px 0', borderRadius: 12,
    background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)',
    color: '#22d3ee', fontSize: 16, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'monospace', flexShrink: 0,
  },
}
