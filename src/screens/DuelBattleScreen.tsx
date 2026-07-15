import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { useTranslation } from 'react-i18next'
import { useGameStore, type DuelConfig } from '../store/gameStore'
import { DuelScene } from '../game/scenes/DuelScene'
import { DuelCountdownOverlay } from '../components/DuelCountdownOverlay'
import { sendWsEvent } from '../api/websocket'


interface HpState {
  playerHp:      number
  playerMaxHp:   number
  opponentHp:    number
  opponentMaxHp: number
}

export function DuelBattleScreen() {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef      = useRef<Phaser.Game | null>(null)
  const frozenCfgRef = useRef<DuelConfig | null>(null)

  const duelConfig = useGameStore((s) => s.activeDuelConfig)
  const endDuel    = useGameStore((s) => s.endDuel)
  const clearDuel  = useGameStore((s) => s.clearDuel)
  const setScreen  = useGameStore((s) => s.setScreen)

  if (duelConfig) frozenCfgRef.current = duelConfig
  const cfg = frozenCfgRef.current

  const [countdown, setCountdown] = useState(true)
  const [hp, setHp]               = useState<HpState | null>(null)
  const [result, setResult]       = useState<'win' | 'lose' | null>(null)

  useEffect(() => {
    if (!containerRef.current || !duelConfig) return

    const scene = new DuelScene()
    scene.setConfig({
      ...duelConfig,
      onEnd: (won) => {
        setResult(won ? 'win' : 'lose')
        setTimeout(() => endDuel(won), 500)
      },
    })

    gameRef.current = new Phaser.Game({
      type:            Phaser.AUTO,
      backgroundColor: '#050a12',
      parent:          containerRef.current,
      scene:           [scene],
      // RESIZE: canvas fills the container exactly, no scaling or black bars.
      // Coordinate normalisation (nx/ny) in DuelScene handles cross-device mapping.
      scale: {
        mode:       Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.NO_CENTER,
      },
      render: { antialias: true, pixelArt: false },
      dom: { createContainer: false },
    })

    const onHp      = (e: Event) => setHp((e as CustomEvent<HpState>).detail)
    const onMove    = (e: Event) => {
      const { nx, ny } = (e as CustomEvent<{nx:number;ny:number}>).detail
      sendWsEvent('duel.move', { duel_id: duelConfig.duelId, nx, ny })
    }
    const onShoot   = (e: Event) => {
      const { ntx, nty } = (e as CustomEvent<{ntx:number;nty:number}>).detail
      sendWsEvent('duel.shoot', { duel_id: duelConfig.duelId, ntx, nty })
    }
    const onHpBcast = (e: Event) => {
      const { hp } = (e as CustomEvent<{hp:number}>).detail
      sendWsEvent('duel.hp_sync', { duel_id: duelConfig.duelId, hp })
    }

    const poll = setInterval(() => {
      const c = containerRef.current?.querySelector('canvas')
      if (c) {
        c.addEventListener('duel-hp',           onHp)
        c.addEventListener('duel-move',         onMove)
        c.addEventListener('duel-shoot',        onShoot)
        c.addEventListener('duel-hp-broadcast', onHpBcast)
        clearInterval(poll)
      }
    }, 80)

    return () => {
      clearInterval(poll)
      const c = containerRef.current?.querySelector('canvas')
      c?.removeEventListener('duel-hp',           onHp)
      c?.removeEventListener('duel-move',         onMove)
      c?.removeEventListener('duel-shoot',        onShoot)
      c?.removeEventListener('duel-hp-broadcast', onHpBcast)
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [duelConfig])  // eslint-disable-line react-hooks/exhaustive-deps

  if (!cfg) return null

  const playerPct     = hp ? Math.max(0, hp.playerHp   / hp.playerMaxHp)   : 1
  const opponentPct   = hp ? Math.max(0, hp.opponentHp / hp.opponentMaxHp) : 1
  const playerHpNum   = hp ? Math.max(0, Math.ceil(hp.playerHp))   : 100
  const opponentHpNum = hp ? Math.max(0, Math.ceil(hp.opponentHp)) : 100

  return (
    <div style={s.root}>
      {/* HP bar */}
      <div style={s.hpBar}>
        <div style={s.hpSide}>
          <div style={s.hpLabel}>
            <span style={{ color: '#00e5ff', fontWeight: 700 }}>⚡ {t('duel.you')}</span>
            <span style={s.hpNum}>{playerHpNum}</span>
          </div>
          <div style={s.hpTrack}>
            <div style={{ ...s.hpFill, width: `${playerPct * 100}%`, background: 'linear-gradient(90deg,#0ea5e9,#00e5ff)' }} />
          </div>
        </div>
        <div style={s.hpVs}>VS</div>
        <div style={s.hpSide}>
          <div style={{ ...s.hpLabel, flexDirection: 'row-reverse' }}>
            <span style={{ color: '#ff4444', fontWeight: 700 }}>🤖 {cfg.opponentName}</span>
            <span style={s.hpNum}>{opponentHpNum}</span>
          </div>
          <div style={{ ...s.hpTrack, transform: 'scaleX(-1)' }}>
            <div style={{ ...s.hpFill, width: `${opponentPct * 100}%`, background: 'linear-gradient(90deg,#ff4444,#ff6b6b)' }} />
          </div>
        </div>
      </div>

      {/* Main area: side panels + scaled Phaser canvas */}
      <div style={s.gameRow}>
        {/* Left decorative panel */}
        <SideDecor side="left" hpPct={playerPct} />

        {/* Canvas container — fills remaining space, FIT scales inside it */}
        <div ref={containerRef} style={s.canvasWrap} />

        {/* Right decorative panel */}
        <SideDecor side="right" hpPct={opponentPct} />
      </div>

      {/* Overlays (positioned over entire root, not just canvas) */}
      {countdown && (
        <DuelCountdownOverlay
          opponentName={cfg.opponentName}
          onDone={() => setCountdown(false)}
        />
      )}

      {result && (
        <div style={s.resultOverlay}>
          <div style={{
            ...s.resultCard,
            borderColor: result === 'win' ? '#39ff14' : '#ff4444',
            background:  result === 'win' ? '#001a00' : '#1a0000',
          }}>
            <div style={{ fontSize: 44 }}>{result === 'win' ? '🏆' : '💥'}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: result === 'win' ? '#39ff14' : '#ff4444' }}>
              {result === 'win' ? t('duel.win') : t('duel.lose')}
            </div>
            <div style={s.resultSub}>
              {result === 'win'
                ? t('duel.wonPrize', {
                    prize: (cfg.betAmount * 2 * 0.75).toFixed(cfg.currency === 'ton' ? 2 : 0),
                    currency: cfg.currency === 'ton' ? 'TON' : '⬡',
                  })
                : t('duel.lostBet', {
                    bet: cfg.betAmount,
                    currency: cfg.currency === 'ton' ? 'TON' : '⬡',
                  })
              }
            </div>
            <button
              style={s.resultBtn}
              onClick={() => { frozenCfgRef.current = null; clearDuel(); setScreen('duel') }}
            >
              {t('duel.playAgain')}
            </button>
          </div>
        </div>
      )}

      {!result && !countdown && (
        <div style={s.hint}>{t('duel.hint')}</div>
      )}
    </div>
  )
}

// ── Decorative side panels ──────────────────────────────────────────────────

function SideDecor({ side, hpPct }: { side: 'left' | 'right'; hpPct: number }) {
  const color = side === 'left' ? '#00e5ff' : '#ff4444'
  const label = side === 'left' ? 'YOU' : 'FOE'
  const widths = [70, 50, 30]

  return (
    <div style={{
      width: 32, alignSelf: 'stretch', display: 'flex', flexDirection: 'column',
      alignItems: 'center', paddingTop: 16, paddingBottom: 16, gap: 8,
    }}>
      <div style={{ fontSize: 8, color, fontFamily: 'monospace', letterSpacing: 1, opacity: 0.5 }}>
        {label}
      </div>

      {/* Vertical HP indicator */}
      <div style={{
        width: 4, flex: 1, maxHeight: 200,
        background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}>
        <div style={{
          width: '100%', borderRadius: 2,
          height: `${hpPct * 100}%`,
          background: color,
          transition: 'height 0.25s ease',
          boxShadow: `0 0 6px ${color}`,
        }} />
      </div>

      {/* Accent lines */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {widths.map((w, i) => (
          <div key={i} style={{
            height: 1, background: color,
            opacity: 0.6 - i * 0.2,
            width: `${w}%`,
            marginLeft: side === 'left' ? 'auto' : 0,
            marginRight: side === 'right' ? 'auto' : 0,
          }} />
        ))}
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root: {
    position: 'relative', width: '100%', height: '100%',
    background: '#02070f', display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  },

  // HP bar strip (full width, fixed height)
  hpBar: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 10px', background: 'rgba(5,10,18,0.92)',
    borderBottom: '1px solid #0f1e2e',
    pointerEvents: 'none', flexShrink: 0, zIndex: 10,
  },
  hpSide:  { flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 },
  hpLabel: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontFamily: 'monospace', color: '#e2e8f0' },
  hpNum:   { fontWeight: 700, fontSize: 12, color: '#94a3b8' },
  hpTrack: { width: '100%', height: 7, borderRadius: 4, background: '#1e293b', overflow: 'hidden' },
  hpFill:  { height: '100%', borderRadius: 4, transition: 'width 0.15s ease' },
  hpVs:    { fontSize: 11, fontWeight: 700, color: '#1e293b', fontFamily: 'monospace', flexShrink: 0 },

  // Game row: side + canvas + side
  gameRow: {
    flex: 1, display: 'flex', alignItems: 'stretch',
    minHeight: 0, overflow: 'hidden',
  },
  // Canvas container — Phaser FIT scales into this div
  canvasWrap: {
    flex: 1, position: 'relative', overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  // Full-screen overlays
  resultOverlay: {
    position: 'absolute', inset: 0, zIndex: 50,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.80)',
  },
  resultCard: {
    borderRadius: 16, padding: '24px 20px', border: '2px solid',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    fontFamily: 'monospace', minWidth: 220,
  },
  resultSub: { fontSize: 13, color: '#94a3b8', textAlign: 'center' },
  resultBtn: {
    marginTop: 6, padding: '10px 24px', borderRadius: 8,
    background: '#06b6d4', border: 'none', color: '#fff',
    fontSize: 14, fontWeight: 700, cursor: 'pointer', pointerEvents: 'auto',
  },
  hint: {
    position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
    fontSize: 11, color: 'rgba(100,116,139,0.65)',
    fontFamily: 'monospace', pointerEvents: 'none',
    whiteSpace: 'nowrap', userSelect: 'none', zIndex: 5,
  },
}
