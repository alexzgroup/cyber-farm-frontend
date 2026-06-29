import { useEffect, useState } from 'react'
import type { ApiUserPublic } from '../api/types'
import styles from './ShieldModal.module.css'

interface Props {
  player: ApiUserPublic | null
  onClose: () => void
  onBuyOwnShield: () => void
}

function fmtRemaining(secondsLeft: number, lang: 'ru' | 'en' = 'ru'): string {
  if (secondsLeft <= 0) return lang === 'en' ? 'expired' : 'истёк'
  const d = Math.floor(secondsLeft / 86400)
  const h = Math.floor((secondsLeft % 86400) / 3600)
  const m = Math.floor((secondsLeft % 3600) / 60)
  if (lang === 'en') {
    if (d > 0) return `${d}d ${h}h`
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }
  if (d > 0) return `${d} дн ${h} ч`
  if (h > 0) return `${h} ч ${m} мин`
  return `${m} мин`
}

export function ShieldedTargetModal({ player, onClose, onBuyOwnShield }: Props) {
  const [, tick] = useState(0)
  // Re-render every minute so the remaining-time label stays fresh while modal is open
  useEffect(() => {
    if (!player) return
    const id = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [player])

  if (!player) return null

  const until = (player.shielded_until ?? 0) * 1000
  const secondsLeft = Math.max(0, Math.floor((until - Date.now()) / 1000))
  const remaining = fmtRemaining(secondsLeft)
  const dateLabel = new Date(until).toLocaleString('ru-RU', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  const name = player.username || player.first_name || `#${player.id}`

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.close} onClick={onClose} aria-label="close">×</button>
        <h3 className={styles.title}>🛡 Цель под защитой</h3>
        <p className={styles.subtitle}>
          <b>{name}</b> сейчас неуязвим для рейдов. Возвращайся когда щит закончится.
        </p>

        <div className={styles.status}>
          ⏳ Осталось: <b>{remaining}</b> · до {dateLabel}
        </div>

        <button className={styles.buyBtn} onClick={onBuyOwnShield} style={{ marginTop: 4 }}>
          🛡 Купить себе щит
        </button>
        <p style={{
          marginTop: 8,
          fontSize: 11,
          color: 'rgba(180, 200, 230, 0.55)',
          textAlign: 'center',
          lineHeight: 1.4,
        }}>
          Чужой щит не получится снять. Защитись сам, пока тебя не атаковали.
        </p>
      </div>
    </div>
  )
}
