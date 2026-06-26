import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore, type RaidResult, type Drone } from '../store/gameStore'
import { PvPHeader } from '../components/PvPHeader'
import { HeartButton } from '../components/HeartButton'
import { getRaidTargets, getRaidHistory, getIncomingRaids, addFavorite, removeFavorite } from '../api'
import type { ApiUserPublic, ApiRaid } from '../api/types'
import { RaidGame } from '../game/RaidGame'
import { fmtGold } from '../utils/format'
import { useCountdown, fmtCooldown } from '../hooks/useCooldown'
import styles from './RaidsScreen.module.css'

type View    = 'targets' | 'battle' | 'result' | 'history'
type HistTab = 'attack' | 'defense'

// ── Target card ───────────────────────────────────────────────────────────────
function TargetCard({ player, attackerLevel, workingDrones, onAttack, onToggleFavorite }: {
  player:           ApiUserPublic
  attackerLevel:    number
  workingDrones:    Drone[]
  onAttack:         (id: number) => void
  onToggleFavorite: (id: number, current: boolean) => void
}) {
  const { t } = useTranslation()
  const onlineStatus = useGameStore((s) => s.onlineStatus)
  const remaining    = useCountdown(player.cooldown_until)
  const onCooldown   = remaining > 0
  const isOnline     = player.id in onlineStatus ? onlineStatus[player.id] : player.is_online

  const attackPower  = workingDrones.reduce((s, d) => s + d.level * 10, 0)
  const defensePower = player.defense_power ?? 0
  const rawChance    = defensePower === 0 ? 95 : Math.round((attackPower / (attackPower + defensePower)) * 100)
  const winChance    = Math.min(95, Math.max(5, rawChance))
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
          <p className={styles.cooldown}>⏱ {t('raids.cooldownLabel')} {fmtCooldown(remaining)}</p>
        ) : (
          <p className={styles.reward}>
            {t('raids.approxCoins', { amount: reward })} ·{' '}
            <span style={{ color: winChance >= 60 ? '#39ff14' : winChance >= 40 ? '#ffaa00' : '#ff4444' }}>
              {t('raids.winChance', { chance: winChance })}
            </span>
          </p>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <HeartButton
          active={!!player.is_favorite}
          onClick={() => onToggleFavorite(player.id, !!player.is_favorite)}
          size={44}
        />
        <button
          className={`${styles.attackBtn} ${disabled ? styles.attackDisabled : ''} ${onCooldown ? styles.attackCooldown : ''}`}
          onClick={() => !disabled && onAttack(player.id)}
          disabled={disabled}
          title={t('raids.attack')}
        >
          {onCooldown ? <span>{fmtCooldown(remaining)}</span> : '⚔️'}
        </button>
      </div>
    </div>
  )
}

const TARGETS_PER_PAGE = 8
const HIST_PER_PAGE    = 15

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

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

// ── History view ──────────────────────────────────────────────────────────────
function HistoryView({ onBack }: { onBack: () => void }) {
  const { t }  = useTranslation()
  const myId   = useGameStore((s) => s.userId)
  const [tab,  setTab]  = useState<HistTab>('attack')
  const [page, setPage] = useState(0)
  const [all,  setAll]  = useState<ApiRaid[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getRaidHistory(), getIncomingRaids()])
      .then(([history, incoming]) => {
        // merge and deduplicate by id
        const map = new Map<number, ApiRaid>()
        ;[...history, ...incoming].forEach((r) => map.set(r.id, r))
        const sorted = Array.from(map.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        setAll(sorted)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const attacks  = all.filter((r) => r.attacker_id === myId)
  const defenses = all.filter((r) => r.defender_id === myId)
  const list     = tab === 'attack' ? attacks : defenses

  const paged = list.slice(page * HIST_PER_PAGE, (page + 1) * HIST_PER_PAGE)

  const switchTab = (t: HistTab) => { setTab(t); setPage(0) }

  return (
    <>
      {/* Header */}
      <div className={styles.histHeader}>
        <button className={styles.histBack} onClick={onBack}>←</button>
        <span className={styles.histTitle}>{t('raids.historyTitle')}</span>
      </div>

      {/* Sub-tabs: Атака | Оборона */}
      <div className={styles.histTabs}>
        <button
          className={`${styles.histTab} ${tab === 'attack' ? styles.histTabActive : ''}`}
          onClick={() => switchTab('attack')}
        >
          ⚔️ {t('raids.tabAttack')}
          {attacks.length > 0 && <span className={styles.badge}>{attacks.length}</span>}
        </button>
        <button
          className={`${styles.histTab} ${tab === 'defense' ? styles.histTabActiveDefense : ''}`}
          onClick={() => switchTab('defense')}
        >
          🛡 {t('raids.tabDefense')}
          {defenses.length > 0 && <span className={`${styles.badge} ${styles.badgeDanger}`}>{defenses.length}</span>}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className={styles.warning}>{t('raids.loading')}</div>
      ) : list.length === 0 ? (
        <div className={styles.warning}>{t('raids.historyEmpty')}</div>
      ) : (
        <div className={styles.histList}>
          {paged.map((r) => {
            const isAttack = r.attacker_id === myId
            const won      = isAttack ? r.result === 'victory' : r.result !== 'victory'
            const opponent = isAttack
              ? (r.defender?.username || r.defender?.first_name || 'Игрок')
              : (r.attacker?.username || r.attacker?.first_name || 'Игрок')
            return (
              <div key={r.id} className={`${styles.histRow} ${won ? styles.histWin : styles.histLose}`}>
                <span className={styles.histIcon}>{won ? (isAttack ? '⚔️' : '🛡') : (isAttack ? '💥' : '😱')}</span>
                <div className={styles.histInfo}>
                  <span className={styles.histName}>{opponent}</span>
                  <span className={styles.histDate}>{fmtDate(r.created_at)}</span>
                </div>
                <div className={styles.histResult}>
                  <span className={`${styles.histStatus} ${won ? styles.histStatusWin : styles.histStatusLose}`}>
                    {won ? t('raids.won') : t('raids.lost')}
                  </span>
                  {r.coins_stolen > 0 && (
                    <span className={styles.histCoins}>
                      {isAttack ? '+' : '-'}{fmtGold(Number(r.coins_stolen))} ⬡
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Pagination page={page} total={list.length} pageSize={HIST_PER_PAGE} onChange={setPage} />
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function RaidsScreen() {
  const [view, setView]           = useState<View>('targets')
  const [raidResult, setResult]   = useState<RaidResult | null>(null)
  const [attackerDrones, setAttackerDrones] = useState<Drone[]>([])
  const [targetTurrets, setTargetTurrets]   = useState<Array<{ level: 1|2|3 }>>([])
  const [targetsPage, setTargetsPage] = useState(0)
  const [targets, setTargets]         = useState<ApiUserPublic[]>([])
  const [targetsLoading, setTargetsLoading] = useState(true)
  const [search, setSearch]           = useState('')
  const { t }       = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)

  const drones      = useGameStore((s) => s.drones)
  const executeRaid = useGameStore((s) => s.executeRaid)
  const setScreen   = useGameStore((s) => s.setScreen)

  const workingDrones = drones.filter((d) => !d.isBroken)
  const attackerLevel = workingDrones.length > 0
    ? Math.max(...workingDrones.map((d) => d.level))
    : 0

  useEffect(() => {
    const trimmed = search.trim()
    if (trimmed.length === 1) return
    setTargetsLoading(true)
    const handle = setTimeout(() => {
      getRaidTargets(trimmed.length >= 2 ? trimmed : undefined)
        .then(setTargets)
        .catch(() => setTargets([]))
        .finally(() => setTargetsLoading(false))
    }, 300)
    return () => clearTimeout(handle)
  }, [search])

  // Auto-trigger raid if we arrived here from Favorites with a pending target
  const pendingRaidTargetId   = useGameStore((s) => s.pendingRaidTargetId)
  const setPendingRaidTarget  = useGameStore((s) => s.setPendingRaidTarget)
  useEffect(() => {
    if (pendingRaidTargetId == null) return
    if (workingDrones.length === 0) {
      setPendingRaidTarget(null)
      return
    }
    const id = pendingRaidTargetId
    setPendingRaidTarget(null)
    handleAttack(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRaidTargetId])

  const handleToggleFavorite = async (id: number, current: boolean) => {
    setTargets((prev) => prev.map((p) => p.id === id ? { ...p, is_favorite: !current } : p))
    try {
      if (current) await removeFavorite(id)
      else         await addFavorite(id)
    } catch {
      setTargets((prev) => prev.map((p) => p.id === id ? { ...p, is_favorite: current } : p))
    }
  }

  const handleAttack = async (targetId: number) => {
    const result = await executeRaid(targetId)
    if (!result) return
    setTargets((prev) => prev.map((p) =>
      p.id === targetId ? { ...p, cooldown_until: Math.floor(Date.now() / 1000) + 3600 } : p
    ))
    setAttackerDrones([...workingDrones])
    const turretLevels = result.defenderTurretLevels ?? []
    setTargetTurrets(
      turretLevels.length > 0
        ? turretLevels.map((lvl) => ({ level: Math.min(3, Math.max(1, lvl)) as 1 | 2 | 3 }))
        : [{ level: 1 as const }]
    )
    setResult(result)
    setView('battle')
  }

  const pagedTargets = targets.slice(
    targetsPage * TARGETS_PER_PAGE,
    (targetsPage + 1) * TARGETS_PER_PAGE
  )

  return (
    <div ref={containerRef} className={styles.screen}>

      {/* ── Battle overlay ── */}
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

      {/* ── Result overlay ── */}
      {view === 'result' && raidResult && (
        <div className={styles.resultOverlay}>
          <div className={`${styles.resultCard} ${raidResult.won ? styles.win : styles.lose}`}>
            <span className={styles.resultIcon}>{raidResult.won ? '🏆' : '💥'}</span>
            <h2 className={styles.resultTitle}>{raidResult.won ? t('raids.victory') : t('raids.defeat')}</h2>
            <p className={styles.resultDesc}>
              {raidResult.won
                ? t('raids.stolenCoins', { amount: fmtGold(raidResult.amount), name: raidResult.targetName })
                : t('raids.droneHurt', { name: raidResult.targetName })}
            </p>
            <button className={styles.backBtn} onClick={() => { setView('targets'); setResult(null) }}>
              {t('raids.back')}
            </button>
          </div>
        </div>
      )}

      {/* ── History view ── */}
      {view === 'history' && (
        <HistoryView onBack={() => setView('targets')} />
      )}

      {/* ── Targets view ── */}
      {view === 'targets' && (
        <>
          <PvPHeader activeTab="raids" onHistory={() => setView('history')} />

          {workingDrones.length === 0 && (
            <div className={styles.warning}>{t('raids.allBroken')}</div>
          )}

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>{t('raids.chooseTarget')}</h3>
              <span className={styles.sectionCount}>{t('raids.playerCount', { count: targets.length })}</span>
            </div>

            <input
              type="text"
              placeholder={t('search.placeholder')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setTargetsPage(0) }}
              style={{
                margin: '0 0 10px', padding: '8px 12px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)',
                color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
              }}
            />

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
                      onToggleFavorite={handleToggleFavorite}
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
        </>
      )}
    </div>
  )
}
