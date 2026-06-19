import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { getDuelHistory } from '../api'
import type { ApiDuel } from '../api/types'
import styles from './DuelHistoryScreen.module.css'

const PAGE_SIZE = 10

function formatDate(iso: string): string {
  const d   = new Date(iso)
  const day = d.getDate().toString().padStart(2, '0')
  const mon = (d.getMonth() + 1).toString().padStart(2, '0')
  const h   = d.getHours().toString().padStart(2, '0')
  const m   = d.getMinutes().toString().padStart(2, '0')
  return `${day}.${mon} ${h}:${m}`
}

function DuelRow({ duel, myId }: { duel: ApiDuel; myId: number }) {
  const { t } = useTranslation()

  const iWon     = duel.winner_id === myId
  const iWasChal = duel.challenger_id === myId
  const opponent = iWasChal ? duel.defender : duel.challenger
  const opponentName = opponent?.first_name || opponent?.username || `#${iWasChal ? duel.defender_id : duel.challenger_id}`

  const prize   = iWon
    ? `+${duel.currency === 'ton' ? '◈' : '⬡'} ${(duel.bet_amount * 2 * 0.95).toFixed(duel.currency === 'ton' ? 2 : 0)}`
    : `−${duel.currency === 'ton' ? '◈' : '⬡'} ${duel.bet_amount}`

  const currLabel = duel.currency === 'ton' ? 'TON' : t('duel.gold')
  const roleLabel = iWasChal ? t('duel.roleChallenger') : t('duel.roleDefender')

  return (
    <div className={styles.row}>
      {/* Result icon */}
      <div
        className={styles.icon}
        style={{
          background: iWon ? 'rgba(57,255,20,0.1)' : 'rgba(255,68,68,0.1)',
          border: `1px solid ${iWon ? 'rgba(57,255,20,0.3)' : 'rgba(255,68,68,0.28)'}`,
        }}
      >
        {iWon ? '🏆' : '💀'}
      </div>

      {/* Opponent */}
      <div className={styles.opponent}>
        <div className={styles.opponentName}>{opponentName}</div>
        <div className={styles.opponentSub}>
          {roleLabel} · {currLabel} · {duel.bet_amount} ставка
        </div>
      </div>

      {/* Badge */}
      <div className={`${styles.badge} ${iWon ? styles.badgeWin : styles.badgeLose}`}>
        {iWon ? t('duel.win') : t('duel.lose')}
      </div>

      {/* Amount + date */}
      <div className={styles.right}>
        <span className={`${styles.amount} ${iWon ? styles.amountWin : styles.amountLose}`}>
          {prize}
        </span>
        <span className={styles.date}>{formatDate(duel.updated_at)}</span>
      </div>
    </div>
  )
}

export function DuelHistoryScreen() {
  const { t }     = useTranslation()
  const setScreen = useGameStore((s) => s.setScreen)
  const myId      = useGameStore((s) => s.userId)

  const [all,     setAll]     = useState<ApiDuel[]>([])
  const [page,    setPage]    = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getDuelHistory()
      .then(setAll)
      .catch(() => setAll([]))
      .finally(() => setLoading(false))
  }, [])

  const totalPages = Math.ceil(all.length / PAGE_SIZE)
  const items = all.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => setScreen('duel')} aria-label="Назад">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <span className={styles.title}>{t('duel.historyTitle')}</span>
        {all.length > 0 && <span className={styles.count}>{all.length}</span>}
      </div>

      {/* Content */}
      {loading ? (
        <div className={styles.empty}>
          <div className={styles.emptyText} style={{ color: 'rgba(255,255,255,0.25)' }}>
            {t('duel.loading')}
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>⚔️</div>
          <div className={styles.emptyText}>{t('duel.historyEmpty')}</div>
        </div>
      ) : (
        <div className={styles.list}>
          {items.map((d) => <DuelRow key={d.id} duel={d} myId={myId} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >←</button>
          <span className={styles.pageInfo}>{page + 1} / {totalPages}</span>
          <button
            className={styles.pageBtn}
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >→</button>
        </div>
      )}
    </div>
  )
}
