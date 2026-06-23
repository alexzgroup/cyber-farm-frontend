import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore, type RaidResult, type Drone, type IncomingRaidEntry } from '../store/gameStore'
import { getRaidTargets, getIncomingRaids } from '../api'
import type { ApiUserPublic, ApiRaid } from '../api/types'
import { RaidGame } from '../game/RaidGame'
import { fmtGold } from '../utils/format'
import { useCountdown, fmtCooldown } from '../hooks/useCooldown'
import styles from './RaidsScreen.module.css'

type View    = 'targets' | 'battle' | 'result'
type LogTab  = 'outgoing' | 'incoming'

// ── Target card with its own cooldown countdown ────────────────────────────
function TargetCard({ player, attackerLevel, workingDrones, onAttack }: {
  player:        ApiUserPublic
  attackerLevel: number
  workingDrones: Drone[]
  onAttack:      (id: number) => void
}) {
  const { t } = useTranslation()
  const onlineStatus = useGameStore((s) => s.onlineStatus)
  const remaining = useCountdown(player.cooldown_until)
  const onCooldown = remaining > 0
  const isOnline = player.id in onlineStatus ? onlineStatus[player.id] : player.is_online

  const winChance = Math.min(85, Math.max(20, Math.round((0.5 + attackerLevel * 0.2) * 100)))
  const reward    = Math.round(Number(player.balance) * 0.1)
  const disabled  = workingDrones.length === 0 || onCooldown

  return (
    <div className={styles.targetCard}>
      <div className={styles.targetInfo}>
        <p className={styles.targetName}>
          <span style={{
            display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
            background: isOnline ? '#39ff14' : '#ef4444',
            marginRight: 6, flexShrink: 0, verticalAlign: 'middle',
            boxShadow: isOnline ? '0 0 4px #39ff14' : undefined,
          }} />
          {player.username || player.first_name || `Player #${player.id}`}
        </p>
        <div className={styles.targetStats}>
          <span>⬡ {Math.round(Number(player.balance))}</span>
        </div>
        {onCooldown ? (
          <p className={styles.cooldown}>
            ⏱ {t('raids.cooldownLabel')} {fmtCooldown(remaining)}
          </p>
        ) : (
          <p className={styles.reward}>
            {t('raids.approxCoins', { amount: reward })} ·{' '}
            <span style={{ color: winChance >= 60 ? '#39ff14' : winChance >= 40 ? '#ffaa00' : '#ff4444' }}>
              {t('raids.winChance', { chance: winChance })}
            </span>
          </p>
        )}
      </div>
      <button
        className={`${styles.attackBtn} ${disabled ? styles.attackDisabled : ''} ${onCooldown ? styles.attackCooldown : ''}`}
        onClick={() => !disabled && onAttack(player.id)}
        disabled={disabled}
      >
        {onCooldown
          ? <><span>{fmtCooldown(remaining)}</span></>
          : <>⚔️<span>{t('raids.attack')}</span></>}
      </button>
    </div>
  )
}

const TARGETS_PER_PAGE = 8
const LOG_PER_PAGE = 20

const tabStyle = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600,
  background: 'none', border: 'none',
  borderBottom: active ? '2px solid #00e5ff' : '2px solid transparent',
  color: active ? '#00e5ff' : '#475569',
  cursor: active ? 'default' : 'pointer',
  fontFamily: 'monospace', letterSpacing: 0.3,
})

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
  const [logTab,      setLogTab]      = useState<LogTab>('outgoing')
  const [targets, setTargets]             = useState<ApiUserPublic[]>([])
  const [targetsLoading, setTargetsLoading] = useState(true)
  const [apiIncoming,   setApiIncoming]   = useState<ApiRaid[]>([])
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)

  const drones         = useGameStore((s) => s.drones)
  const raidLog        = useGameStore((s) => s.raidLog)
  const incomingRaidLog = useGameStore((s) => s.incomingRaidLog)
  const executeRaid    = useGameStore((s) => s.executeRaid)
  const setScreen      = useGameStore((s) => s.setScreen)

  const workingDrones = drones.filter((d) => !d.isBroken)
  const attackerLevel = workingDrones.length > 0
    ? Math.max(...workingDrones.map((d) => d.level))
    : 0

  // Load raid targets
  useEffect(() => {
    getRaidTargets()
      .then(setTargets)
      .catch(() => setTargets([]))
      .finally(() => setTargetsLoading(false))
  }, [])

  // Load incoming raid history from API (merges with WS live entries)
  useEffect(() => {
    getIncomingRaids()
      .then(setApiIncoming)
      .catch(() => {})
  }, [])

  const handleAttack = async (targetId: number) => {
    const result = await executeRaid(targetId)
    if (!result) return
    // Set cooldown_until on this target immediately (optimistic, before next API reload)
    setTargets((prev) => prev.map((p) =>
      p.id === targetId
        ? { ...p, cooldown_until: Math.floor(Date.now() / 1000) + 3600 }
        : p
    ))
    setAttackerDrones([...workingDrones])
    setTargetTurrets([{ level: 1 }])
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
                ? t('raids.stolenCoins', {amount: fmtGold(raidResult.amount), name: raidResult.targetName})
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
          {/* PvP mode switcher */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
            <button style={tabStyle(false)} onClick={() => setScreen('duel')}>⚔️ {t('nav.duel')}</button>
            <button style={tabStyle(true)}>💥 {t('raids.title')}</button>
          </div>

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
                  {pagedTargets.map((player) => (
                    <TargetCard
                      key={player.id}
                      player={player}
                      attackerLevel={attackerLevel}
                      workingDrones={workingDrones}
                      onAttack={handleAttack}
                    />
                  ))}
                </div>
                <Pagination
                  page={targetsPage} total={targets.length}
                  pageSize={TARGETS_PER_PAGE} onChange={setTargetsPage}
                />
              </>
            )}
          </section>

              {/* Log tabs */}
          <section className={styles.section}>
            <div className={styles.logTabs}>
              <button
                className={`${styles.logTab} ${logTab === 'outgoing' ? styles.logTabActive : ''}`}
                onClick={() => { setLogTab('outgoing'); setLogPage(0) }}
              >
                {t('raids.tabOutgoing')}
                {raidLog.length > 0 && <span className={styles.badge}>{raidLog.length}</span>}
              </button>
              <button
                className={`${styles.logTab} ${logTab === 'incoming' ? styles.logTabActive : ''}`}
                onClick={() => { setLogTab('incoming'); setLogPage(0) }}
              >
                {t('raids.tabIncoming')}
                {(incomingRaidLog.length + apiIncoming.length) > 0 && (
                  <span className={`${styles.badge} ${styles.badgeDanger}`}>
                    {Math.max(incomingRaidLog.length, apiIncoming.length)}
                  </span>
                )}
              </button>
            </div>

            {logTab === 'outgoing' && (
              raidLog.length === 0
                ? <div className={styles.warning}>{t('raids.noTargets')}</div>
                : <>
                    <div className={styles.log}>
                      {pagedLog.map((entry) => (
                        <div key={entry.id} className={`${styles.logEntry} ${entry.won ? styles.logWin : styles.logLose}`}>
                          <span className={styles.logIcon}>{entry.won ? '✓' : '✗'}</span>
                          <span className={styles.logName}>{entry.targetName}</span>
                          <span className={styles.logResult}>
                            {entry.won ? `+${fmtGold(entry.amount)} ⬡` : t('raids.droneBroken')}
                          </span>
                        </div>
                      ))}
                    </div>
                    <Pagination page={logPage} total={raidLog.length} pageSize={LOG_PER_PAGE} onChange={setLogPage} />
                  </>
            )}

            {logTab === 'incoming' && (() => {
              // Merge live WS entries with API history, deduplicate by id
              const wsIds = new Set(incomingRaidLog.map((e) => e.id))
              const apiEntries: IncomingRaidEntry[] = apiIncoming
                .filter((r) => !wsIds.has(String(r.id)))
                .map((r) => ({
                  id:           String(r.id),
                  attackerName: r.attacker?.username || r.attacker?.first_name || `#${r.attacker_id}`,
                  attackerId:   r.attacker_id,
                  won:          r.result !== 'victory',
                  amount:       Number(r.coins_stolen),
                  timestamp:    new Date(r.created_at).getTime(),
                }))
              const merged = [...incomingRaidLog, ...apiEntries]
                .sort((a, b) => b.timestamp - a.timestamp)

              if (merged.length === 0) {
                return <div className={styles.warning}>{t('raids.incomingEmpty')}</div>
              }

              const paged = merged.slice(logPage * LOG_PER_PAGE, (logPage + 1) * LOG_PER_PAGE)
              return (
                <>
                  <div className={styles.log}>
                    {paged.map((entry) => (
                      <div key={entry.id} className={`${styles.logEntry} ${entry.won ? styles.logWin : styles.logLose}`}>
                        <span className={styles.logIcon}>{entry.won ? '🛡' : '💥'}</span>
                        <span className={styles.logName}>
                          <span style={{ opacity: 0.55, fontSize: 11, marginRight: 4 }}>{t('raids.incomingAttackedBy')}</span>
                          {entry.attackerName}
                        </span>
                        <span className={styles.logResult}>
                          {entry.won
                            ? <span style={{ color: '#39ff90' }}>{t('raids.incomingDefended')} +{fmtGold(entry.amount)} 🛡</span>
                            : <span style={{ color: '#ff6b6b' }}>{t('raids.incomingStolen', { amount: fmtGold(entry.amount) })}</span>
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                  <Pagination page={logPage} total={merged.length} pageSize={LOG_PER_PAGE} onChange={setLogPage} />
                </>
              )
            })()}</section>
        </>
      )}
    </div>
  )
}
