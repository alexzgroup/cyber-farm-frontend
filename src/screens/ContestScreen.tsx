import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { getContestCurrent, getContestLast } from '../api'
import type { ContestCurrent, ContestLast } from '../api/types'
import styles from './ContestScreen.module.css'

// ── Countdown ──────────────────────────────────────────────────────────────

function useCountdown(target: string | null) {
  const [diff, setDiff] = useState(0)

  useEffect(() => {
    if (!target) return
    const tick = () => setDiff(Math.max(0, new Date(target).getTime() - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [target])

  const s = Math.floor(diff / 1000)
  return {
    days:    Math.floor(s / 86400),
    hours:   Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  }
}

function Countdown({ target }: { target: string | null }) {
  const { t } = useTranslation()
  const { days, hours, minutes, seconds } = useCountdown(target)
  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div className={styles.countdownTime}>
      {days > 0 && (
        <>
          <div className={styles.countdownUnit}>
            <span className={styles.countdownNum}>{days}</span>
            <span className={styles.countdownUnitLabel}>{t('contest.days')}</span>
          </div>
          <span className={styles.countdownSep}>:</span>
        </>
      )}
      <div className={styles.countdownUnit}>
        <span className={styles.countdownNum}>{pad(hours)}</span>
        <span className={styles.countdownUnitLabel}>{t('contest.hours')}</span>
      </div>
      <span className={styles.countdownSep}>:</span>
      <div className={styles.countdownUnit}>
        <span className={styles.countdownNum}>{pad(minutes)}</span>
        <span className={styles.countdownUnitLabel}>{t('contest.minutes')}</span>
      </div>
      <span className={styles.countdownSep}>:</span>
      <div className={styles.countdownUnit}>
        <span className={styles.countdownNum}>{pad(seconds)}</span>
        <span className={styles.countdownUnitLabel}>{t('contest.seconds')}</span>
      </div>
    </div>
  )
}

// ── Podium — top 3 last winners ────────────────────────────────────────────

const MEDALS = ['🥇', '🥈', '🥉']
const PODIUM_CLASSES = [styles.first, styles.second, styles.third]

function Podium({ last }: { last: ContestLast }) {
  const { t } = useTranslation()

  if (!last.contest || last.winners.length === 0) {
    return <div className={styles.empty}>{t('contest.noLastContest')}</div>
  }

  // Reorder: 2nd | 1st | 3rd for visual podium effect
  const ordered = [last.winners[1], last.winners[0], last.winners[2]].filter(Boolean)
  const orderClass = [styles.second, styles.first, styles.third]
  const orderMedal = [MEDALS[1], MEDALS[0], MEDALS[2]]

  return (
    <div className={styles.podium}>
      {ordered.map((w, i) => {
        const name = w.username ? `@${w.username}` : w.first_name || 'Игрок'
        return (
          <div key={w.rank} className={`${styles.podiumItem} ${orderClass[i]}`}>
            <span className={styles.podiumMedal}>{orderMedal[i]}</span>
            <span className={styles.podiumName}>{name}</span>
            <span className={styles.podiumScore}>⬡ {w.score.toLocaleString('ru')}</span>
            <span className={styles.podiumPrize}>◈ {parseFloat(w.prize_gold.toFixed(4))} TON</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main screen ────────────────────────────────────────────────────────────

export function ContestScreen() {
  const { t }     = useTranslation()
  const setScreen = useGameStore((s) => s.setScreen)
  const telegramId = useGameStore((s) => s.telegramId)

  const [current, setCurrent] = useState<ContestCurrent | null>(null)
  const [last,    setLast]    = useState<ContestLast | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getContestCurrent(), getContestLast()])
      .then(([c, l]) => { setCurrent(c); setLast(l) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => setScreen('farm')} aria-label="Назад">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <span className={styles.title}>🏆 {t('contest.title')}</span>
      </div>

      {loading ? (
        <div className={styles.loading}>⏳</div>
      ) : (
        <div className={styles.body}>

          {/* Pool hero */}
          <div className={styles.poolCard}>
            <div className={styles.poolLabel}>{t('contest.pool')}</div>
            <div className={styles.poolAmount}>
              <span className={styles.poolCoin}>◈</span>
              {(current?.pool_ton ?? 0).toFixed(2)}
              <span className={styles.poolUnit}> TON</span>
            </div>
            <div className={styles.poolHint}>{t('contest.contribution')}</div>
          </div>

          {/* Countdown */}
          <div className={styles.countdownCard}>
            <div className={styles.countdownLabel}>{t('contest.nextContest')}</div>
            <Countdown target={current?.next_contest_at ?? null} />
          </div>

          {/* Last winners podium */}
          <div className={styles.secLabel}>
            <span className={styles.secDot} />
            {t('contest.lastWinners')}
          </div>
          {last ? <Podium last={last} /> : <div className={styles.empty}>{t('contest.noLastContest')}</div>}

          {/* Current leaderboard */}
          <div className={styles.secLabel}>
            <span className={styles.secDot} />
            {t('contest.leaderboard')}
            {current && <span style={{ marginLeft: 6, opacity: 0.5, fontWeight: 400 }}>
              {current.participants} {t('contest.participants').toLowerCase()}
            </span>}
          </div>

          {(!current || current.leaderboard.length === 0) ? (
            <div className={styles.empty}>{t('contest.emptyLeaderboard')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {current.leaderboard.map((entry) => {
                const isMe = entry.user_id === telegramId
                const name = entry.username ? `@${entry.username}` : entry.first_name || 'Игрок'
                const isTop = entry.rank <= 3
                return (
                  <div key={entry.rank} className={`${styles.lbRow} ${isMe ? styles.myRow : ''}`}>
                    <span className={`${styles.lbRank} ${isTop ? styles.lbRankTop : ''}`}>
                      {isTop ? MEDALS[entry.rank - 1] : entry.rank}
                    </span>
                    <span className={styles.lbName}>{name}{isMe ? ' 👈' : ''}</span>
                    <span className={styles.lbScore}>⬡ {entry.score.toLocaleString('ru')}</span>
                    {entry.projected_prize > 0 && (
                      <span className={styles.lbPrize}>
                        ~◈ {parseFloat(entry.projected_prize.toFixed(4))} TON
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

        </div>
      )}
    </div>
  )
}
