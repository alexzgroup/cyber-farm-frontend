import { useState, useRef } from 'react'
import { useGameStore, RaidResult } from '../store/gameStore'
import { MOCK_PLAYERS } from '../data/mockPlayers'
import { RaidGame } from '../game/RaidGame'
import styles from './RaidsScreen.module.css'

type View = 'targets' | 'battle' | 'result'

export function RaidsScreen() {
  const [view, setView]         = useState<View>('targets')
  const [raidResult, setResult] = useState<RaidResult | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const drones      = useGameStore((s) => s.drones)
  const raidLog     = useGameStore((s) => s.raidLog)
  const executeRaid = useGameStore((s) => s.executeRaid)

  const workingDrones = drones.filter((d) => !d.isBroken)

  const handleAttack = (targetId: string) => {
    const result = executeRaid(targetId)
    if (!result) return
    setResult(result)
    setView('battle')
  }

  const handleBattleComplete = () => setView('result')

  const handleBackToTargets = () => {
    setView('targets')
    setResult(null)
  }

  return (
    <div ref={containerRef} className={styles.screen}>
      {view === 'battle' && raidResult && (
        <div className={styles.battleOverlay}>
          <RaidGame
            result={raidResult}
            onComplete={handleBattleComplete}
          />
        </div>
      )}

      {view === 'result' && raidResult && (
        <div className={styles.resultOverlay}>
          <div className={`${styles.resultCard} ${raidResult.won ? styles.win : styles.lose}`}>
            <span className={styles.resultIcon}>{raidResult.won ? '🏆' : '💥'}</span>
            <h2 className={styles.resultTitle}>
              {raidResult.won ? 'Победа!' : 'Поражение'}
            </h2>
            <p className={styles.resultDesc}>
              {raidResult.won
                ? `Украдено ${raidResult.amount} монет у ${raidResult.targetName}`
                : `${raidResult.targetName} отбил атаку — дрон повреждён`}
            </p>
            <button className={styles.backBtn} onClick={handleBackToTargets}>
              Назад к рейдам
            </button>
          </div>
        </div>
      )}

      {view === 'targets' && (
        <>
          <h2 className={styles.title}>PvP-рейды</h2>

          {workingDrones.length === 0 && (
            <div className={styles.warning}>
              ⚠️ Все дроны сломаны — сначала почини их в магазине
            </div>
          )}

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Выбери цель</h3>
            <div className={styles.targets}>
              {MOCK_PLAYERS.map((player) => {
                const attackerLevel = workingDrones.length > 0
                  ? Math.max(...workingDrones.map((d) => d.level))
                  : 0
                const winChance = Math.min(85, Math.max(20,
                  Math.round((0.5 + (attackerLevel - player.defenseLevel) * 0.2) * 100)
                ))
                const reward = Math.round(player.balance * 0.15)

                return (
                  <div key={player.id} className={styles.targetCard}>
                    <div className={styles.targetInfo}>
                      <p className={styles.targetName}>{player.name}</p>
                      <div className={styles.targetStats}>
                        <span>⬡ {player.balance}</span>
                        <span>🛡 Ур.{player.defenseLevel}</span>
                        <span>🤖 {player.droneCount}</span>
                      </div>
                      <p className={styles.reward}>
                        ~{reward} монет · {winChance}% победы
                      </p>
                    </div>
                    <button
                      className={`${styles.attackBtn} ${workingDrones.length === 0 ? styles.attackDisabled : ''}`}
                      onClick={() => handleAttack(player.id)}
                      disabled={workingDrones.length === 0}
                    >
                      ⚔️
                      <span>Атака</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </section>

          {raidLog.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Лог сражений</h3>
              <div className={styles.log}>
                {raidLog.map((entry) => (
                  <div key={entry.id} className={`${styles.logEntry} ${entry.won ? styles.logWin : styles.logLose}`}>
                    <span className={styles.logIcon}>{entry.won ? '✓' : '✗'}</span>
                    <span className={styles.logName}>{entry.targetName}</span>
                    <span className={styles.logResult}>
                      {entry.won ? `+${entry.amount}` : 'дрон сломан'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
