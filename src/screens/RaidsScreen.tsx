import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore, type RaidResult, type Drone } from '../store/gameStore'
import { getRaidTargets } from '../api'
import type { ApiUserPublic } from '../api/types'
import { RaidGame } from '../game/RaidGame'
import styles from './RaidsScreen.module.css'

type View = 'targets' | 'battle' | 'result'

const TARGETS_PER_PAGE = 8
const LOG_PER_PAGE     = 20

function Pagination({ page, total, pageSize, onChange }: {
  page: number; total: number; pageSize: number; onChange: (p: number) => void
}) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null
  return (
    <div className={styles.pagination}>
      <button className={styles.pageBtn} disabled={page === 0} onClick={() => onChange(page - 1)}>←</button>
      <span className={styles.pageInfo}>{page + 1} / {totalPages}</span>
      <button className={styles.pageBtn} disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)}>→</button>
    </div>
  )
}

export function RaidsScreen() {
  const [view, setView]           = useState<View>('targets')
  const [raidResult, setResult]   = useState<RaidResult | null>(null)
  const [attackerDrones, setAttackerDrones] = useState<Drone[]>([])
  const [targetTurrets, setTargetTurrets]   = useState<Array<{ level: 1|2|3 }>>([])
  const [targetsPage, setTargetsPage] = useState(0)
  const [logPage,     setLogPage]     = useState(0)
  const [targets, setTargets]         = useState<ApiUserPublic[]>([])
  const [targetsLoading, setTargetsLoading] = useState(true)
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)

  const drones      = useGameStore((s) => s.drones)
  const raidLog     = useGameStore((s) => s.raidLog)
  const executeRaid = useGameStore((s) => s.executeRaid)

  const workingDrones = drones.filter((d) => !d.isBroken)
  const attackerLevel = workingDrones.length > 0
    ? Math.max(...workingDrones.map((d) => d.level))
    : 0

  // Load raid targets from API
  useEffect(() => {
    getRaidTargets()
      .then(setTargets)
      .catch(() => setTargets([]))
      .finally(() => setTargetsLoading(false))
  }, [])

  const handleAttack = async (targetId: number) => {
    const result = await executeRaid(targetId)
    if (!result) return
    setAttackerDrones([...workingDrones])
    setTargetTurrets([{ level: 1 }]) // turrets shown in battle scene
    setResult(result)
    setView('battle')
  }

  const pagedTargets = targets.slice(
    targetsPage * TARGETS_PER_PAGE,
    (targetsPage + 1) * TARGETS_PER_PAGE
  )

  const pagedLog = raidLog.slice(
    logPage * LOG_PER_PAGE,
    (logPage + 1) * LOG_PER_PAGE
  )

  return (
    <div ref={containerRef} className={styles.screen}>
      {view === 'battle' && raidResult && (
        <div className={styles.battleOverlay}>
          <RaidGame
            result={raidResult}
            attackerDrones={attackerDrones}
            targetTurrets={targetTurrets}
            onComplete={() => setView('result')}
          />
        </div>
      )}

      {view === 'result' && raidResult && (
        <div className={styles.resultOverlay}>
          <div className={`${styles.resultCard} ${raidResult.won ? styles.win : styles.lose}`}>
            <span className={styles.resultIcon}>{raidResult.won ? '🏆' : '💥'}</span>
            <h2 className={styles.resultTitle}>{raidResult.won ? t('raids.victory') : t('raids.defeat')}</h2>
            <p className={styles.resultDesc}>
              {raidResult.won
                ? t('raids.stolenCoins', {amount: raidResult.amount, name: raidResult.targetName})
                : t('raids.droneHurt', {name: raidResult.targetName})}
            </p>
            <button className={styles.backBtn} onClick={() => { setView('targets'); setResult(null) }}>
              {t('raids.back')}
            </button>
          </div>
        </div>
      )}

      {view === 'targets' && (
        <>
          <h2 className={styles.title}>{t('raids.title')}</h2>

          {workingDrones.length === 0 && (
            <div className={styles.warning}>
              {t('raids.allBroken')}
            </div>
          )}

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>{t('raids.chooseTarget')}</h3>
              <span className={styles.sectionCount}>{t('raids.playerCount', { count: targets.length })}</span>
            </div>

            {targetsLoading ? (
              <div className={styles.warning}>{t('raids.loading')}</div>
            ) : targets.length === 0 ? (
              <div className={styles.warning}>{t('raids.noTargets')}</div>
            ) : (
              <>
                <div className={styles.targets}>
                  {pagedTargets.map((player) => {
                    const winChance = Math.min(85, Math.max(20,
                      Math.round((0.5 + attackerLevel * 0.2) * 100)
                    ))
                    const reward = Math.round(Number(player.balance) * 0.1)

                    return (
                      <div key={player.id} className={styles.targetCard}>
                        <div className={styles.targetInfo}>
                          <p className={styles.targetName}>
                            {player.username || player.first_name || `Player #${player.id}`}
                          </p>
                          <div className={styles.targetStats}>
                            <span>⬡ {Math.round(Number(player.balance))}</span>
                          </div>
                          <p className={styles.reward}>
                            {t('raids.approxCoins', {amount: reward})} ·{' '}
                            <span style={{ color: winChance >= 60 ? '#39ff14' : winChance >= 40 ? '#ffaa00' : '#ff4444' }}>
                              {t('raids.winChance', {chance: winChance})}
                            </span>
                          </p>
                        </div>
                        <button
                          className={`${styles.attackBtn} ${workingDrones.length === 0 ? styles.attackDisabled : ''}`}
                          onClick={() => handleAttack(player.id)}
                          disabled={workingDrones.length === 0}
                        >
                          ⚔️<span>{t('raids.attack')}</span>
                        </button>
                      </div>
                    )
                  })}
                </div>
                <Pagination
                  page={targetsPage} total={targets.length}
                  pageSize={TARGETS_PER_PAGE} onChange={setTargetsPage}
                />
              </>
            )}
          </section>

          {raidLog.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>{t('raids.log')}</h3>
                <span className={styles.sectionCount}>{t('raids.raidCount', { count: raidLog.length })}</span>
              </div>
              <div className={styles.log}>
                {pagedLog.map((entry) => (
                  <div key={entry.id} className={`${styles.logEntry} ${entry.won ? styles.logWin : styles.logLose}`}>
                    <span className={styles.logIcon}>{entry.won ? '✓' : '✗'}</span>
                    <span className={styles.logName}>{entry.targetName}</span>
                    <span className={styles.logResult}>
                      {entry.won ? `+${entry.amount} ⬡` : t('raids.droneBroken')}
                    </span>
                  </div>
                ))}
              </div>
              <Pagination page={logPage} total={raidLog.length} pageSize={LOG_PER_PAGE} onChange={setLogPage} />
            </section>
          )}
        </>
      )}
    </div>
  )
}
