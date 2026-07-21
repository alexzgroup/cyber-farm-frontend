// Duel battle screen — split rendering.
//
// Phaser owns the arena canvas: drones (DuelDroneSprite with spinning
// rotors), gun barrels, bullets, muzzle flash, hit / dodge FX, death
// explosion, camera shake. See DuelScene.ts.
//
// React owns the HUD chrome around it: top HP bar, quadrant labels,
// vertical side HP bars, D-pad, aim dial, sound toggle, countdown
// & result overlays. React and Phaser talk via CustomEvents on the
// canvas element marked with `data-duel`.

import { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { useTranslation } from 'react-i18next'
import { useGameStore, type DuelConfig } from '../store/gameStore'
import { DuelCountdownOverlay } from '../components/DuelCountdownOverlay'
import { BanOverlay } from '../components/BanOverlay'
import { sendWsEvent } from '../api/websocket'
import { DuelScene } from '../game/scenes/DuelScene'
import { startDuelMusic, stopDuelMusic, isDuelMusicPlaying } from '../game/utils/duelMusic'
import s from './DuelBattleScreen.module.css'

export function DuelBattleScreen() {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef      = useRef<Phaser.Game | null>(null)
  const canvasElRef  = useRef<HTMLCanvasElement | null>(null)
  const frozenCfgRef = useRef<DuelConfig | null>(null)

  const duelConfig = useGameStore((st) => st.activeDuelConfig)
  const endDuel    = useGameStore((st) => st.endDuel)
  const clearDuel  = useGameStore((st) => st.clearDuel)
  const setScreen  = useGameStore((st) => st.setScreen)
  const myUserId   = useGameStore((st) => st.userId)
  const bannedUntil  = useGameStore((st) => st.bannedUntil)
  const bannedReason = useGameStore((st) => st.bannedReason)
  const isBanned = bannedUntil != null && bannedUntil > Date.now()

  if (duelConfig) frozenCfgRef.current = duelConfig
  const cfg = frozenCfgRef.current

  // ── React state (HUD only) ────────────────────────────────────────────
  const [countdown, setCountdown] = useState(true)
  const [result, setResult]       = useState<'win' | 'lose' | null>(null)
  const [mePos,  setMePos]  = useState({ x: 0.25, y: 0.5 })
  const [meHp,   setMeHp]   = useState({ hp: 100, max: 100 })
  const [foeHp,  setFoeHp]  = useState({ hp: 100, max: 100 })
  const [aimAngle, setAimAngle] = useState(0) // degrees; 0 = right
  // Music is ON by default when a duel starts. If the browser blocks
  // autoplay (Safari/mobile), we retry on the first user gesture below.
  const [musicOn, setMusicOn] = useState(true)

  // Aim-dial pointer drag
  const aimRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ dragging: false, moved: false, sx: 0, sy: 0 })
  const ticksRef = useRef<HTMLCanvasElement>(null)

  // ── Phaser mount ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !duelConfig) return

    const scene = new DuelScene()
    scene.setConfig({
      duelId:   duelConfig.duelId,
      myUserId,
      onEnd: (won) => {
        setResult(won ? 'win' : 'lose')
        setTimeout(() => endDuel(won), 500)
      },
    })

    const game = new Phaser.Game({
      type:            Phaser.AUTO,
      backgroundColor: '#02060e',
      parent:          containerRef.current,
      scene:           [scene],
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.NO_CENTER },
      render: { antialias: true, pixelArt: false },
      dom: { createContainer: false },
    })
    gameRef.current = game

    // Grab the canvas once Phaser mounts it, so React handlers can dispatch
    // CustomEvents onto it (duel-aim from the HUD).
    const findCanvas = setInterval(() => {
      const c = containerRef.current?.querySelector('canvas') as HTMLCanvasElement | null
      if (c) {
        canvasElRef.current = c
        clearInterval(findCanvas)
      }
    }, 60)

    return () => {
      clearInterval(findCanvas)
      game.destroy(true)
      gameRef.current = null
      canvasElRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duelConfig?.duelId])

  // ── WS event mirror for HUD (HP + result + heartbeat position). We use
  //    the same events Phaser subscribes to (duel-*): they're dispatched on
  //    the canvas by websocket.ts, and non-canvas listeners here just read.
  useEffect(() => {
    if (!duelConfig) return
    // We wait for the canvas to exist. Once it does, attach passive listeners
    // for HP + position + force-end. Phaser has its own copies.
    let cleanup: (() => void) | null = null
    const attach = () => {
      const canvas = canvasElRef.current
      if (!canvas) return false

      const onStartState = (e: Event) => {
        const p = (e as CustomEvent<any>).detail
        const me  = p.players.find((pl: any) => pl.user_id === myUserId)
        const foe = p.players.find((pl: any) => pl.user_id !== myUserId)
        if (me)  { setMeHp({ hp: me.hp, max: me.max_hp });   setMePos({ x: me.x, y: me.y }) }
        if (foe) { setFoeHp({ hp: foe.hp, max: foe.max_hp }) }
      }
      const onState = (e: Event) => {
        const p = (e as CustomEvent<any>).detail
        const me  = p.players.find((pl: any) => pl.user_id === myUserId)
        const foe = p.players.find((pl: any) => pl.user_id !== myUserId)
        if (me)  { setMeHp((cur) => ({ ...cur, hp: me.hp }));   setMePos({ x: me.x, y: me.y }) }
        if (foe) { setFoeHp((cur) => ({ ...cur, hp: foe.hp })) }
      }
      canvas.addEventListener('duel-start-state', onStartState)
      canvas.addEventListener('duel-state',       onState)
      cleanup = () => {
        canvas.removeEventListener('duel-start-state', onStartState)
        canvas.removeEventListener('duel-state',       onState)
      }
      return true
    }
    if (!attach()) {
      const iv = setInterval(() => { if (attach()) clearInterval(iv) }, 60)
      return () => { clearInterval(iv); cleanup?.() }
    }
    return () => cleanup?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duelConfig?.duelId])

  // ── Send the current aim angle down to Phaser whenever it changes ────
  useEffect(() => {
    const canvas = canvasElRef.current; if (!canvas) return
    canvas.dispatchEvent(new CustomEvent('duel-aim', {
      detail: { angleRad: aimAngle * Math.PI / 180 },
    }))
  }, [aimAngle])

  // ── Aim-dial pointer handlers ────────────────────────────────────────
  const onAimDown = (e: React.PointerEvent) => {
    dragRef.current = { dragging: true, moved: false, sx: e.clientX, sy: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onAimMove = (e: React.PointerEvent) => {
    if (!dragRef.current.dragging) return
    const el = aimRef.current; if (!el) return
    const r = el.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2)
    const dy = e.clientY - (r.top  + r.height / 2)
    if (Math.hypot(dx, dy) > 4) dragRef.current.moved = true
    setAimAngle(Math.atan2(dy, dx) * 180 / Math.PI)
  }
  const onAimUp = (e: React.PointerEvent) => {
    if (dragRef.current.dragging) {
      if (!dragRef.current.moved) fire() // tap = fire
      else                        fire() // drag-release also fires (aim + release)
    }
    dragRef.current.dragging = false
    ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
  }

  // ── Fire (send shoot event with far target along aim direction) ──────
  const fire = () => {
    if (!duelConfig) return
    const rad = aimAngle * Math.PI / 180
    const FAR = 10
    const nx = Math.max(0, Math.min(1, mePos.x + Math.cos(rad) * FAR))
    const ny = Math.max(0, Math.min(1, mePos.y + Math.sin(rad) * FAR))
    sendWsEvent('duel.shoot', { duel_id: duelConfig.duelId, ntx: +nx.toFixed(4), nty: +ny.toFixed(4) })
    // Re-trigger ring-pulse on the aim dial (ticks canvas stays intact).
    const el = aimRef.current
    if (el) {
      el.classList.remove(s.aimFire)
      void el.offsetWidth
      el.classList.add(s.aimFire)
    }
  }
  const fireRef = useRef<() => void>(fire)
  fireRef.current = fire

  // ── D-pad: continuous move while pressed ─────────────────────────────
  const dpadIntervalRef = useRef<Record<string, ReturnType<typeof setInterval> | null>>({
    up: null, down: null, left: null, right: null,
  })
  const arenaRefForSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 })
  useEffect(() => {
    const el = containerRef.current; if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      arenaRefForSize.current = { w: r.width, h: r.height }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pushMove = (dx: number, dy: number) => {
    if (!duelConfig) return
    const p = mePos
    const arena = arenaRefForSize.current
    const halfNormX = arena.w > 0 ? 52 / arena.w : 0.06
    const halfNormY = arena.h > 0 ? 52 / arena.h : 0.06
    const nx = Math.max(halfNormX, Math.min(1 - halfNormX, p.x + dx * 0.3))
    const ny = Math.max(halfNormY, Math.min(1 - halfNormY, p.y + dy * 0.3))
    sendWsEvent('duel.move', { duel_id: duelConfig.duelId, nx: +nx.toFixed(4), ny: +ny.toFixed(4) })
  }
  const pushMoveRef = useRef(pushMove)
  pushMoveRef.current = pushMove

  const startDpad = (dir: 'up' | 'down' | 'left' | 'right') => {
    const tick = () => {
      const pm = pushMoveRef.current
      if (dir === 'up')    pm(0, -1)
      if (dir === 'down')  pm(0,  1)
      if (dir === 'left')  pm(-1, 0)
      if (dir === 'right') pm( 1, 0)
    }
    tick()
    if (dpadIntervalRef.current[dir]) clearInterval(dpadIntervalRef.current[dir]!)
    dpadIntervalRef.current[dir] = setInterval(tick, 90)
  }
  const stopDpad = (dir: 'up' | 'down' | 'left' | 'right') => {
    if (dpadIntervalRef.current[dir]) {
      clearInterval(dpadIntervalRef.current[dir]!)
      dpadIntervalRef.current[dir] = null
    }
  }

  // ── Keyboard controls (WASD / arrows + Space) ────────────────────────
  useEffect(() => {
    if (!duelConfig) return
    const held = new Set<string>()
    const kb: Record<string, ReturnType<typeof setInterval> | null> = {
      up: null, down: null, left: null, right: null,
    }
    const dirOf = (code: string): 'up' | 'down' | 'left' | 'right' | null => {
      switch (code) {
        case 'ArrowUp':    case 'KeyW': return 'up'
        case 'ArrowDown':  case 'KeyS': return 'down'
        case 'ArrowLeft':  case 'KeyA': return 'left'
        case 'ArrowRight': case 'KeyD': return 'right'
        default: return null
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.code === 'Space') { e.preventDefault(); fireRef.current?.(); return }
      const dir = dirOf(e.code); if (!dir) return
      e.preventDefault()
      if (held.has(dir)) return
      held.add(dir)
      const tick = () => startDpad(dir)
      tick()
      if (kb[dir]) clearInterval(kb[dir]!)
      kb[dir] = setInterval(tick, 90)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      const dir = dirOf(e.code); if (!dir) return
      held.delete(dir)
      if (kb[dir]) { clearInterval(kb[dir]!); kb[dir] = null }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup',   onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup',   onKeyUp)
      for (const k in kb) if (kb[k]) clearInterval(kb[k]!)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duelConfig?.duelId])

  // ── Heartbeat so the server doesn't idle-forfeit us ──────────────────
  useEffect(() => {
    if (!duelConfig) return
    const iv = setInterval(() => {
      sendWsEvent('duel.move', {
        duel_id: duelConfig.duelId,
        nx: +mePos.x.toFixed(4),
        ny: +mePos.y.toFixed(4),
      })
    }, 5000)
    return () => clearInterval(iv)
  }, [duelConfig, mePos.x, mePos.y])

  // ── Aim-dial ticks (draw once — canvas is not remounted on fire) ─────
  useEffect(() => {
    const c = ticksRef.current; if (!c) return
    const size = 120
    c.width = size; c.height = size
    const g = c.getContext('2d'); if (!g) return
    g.clearRect(0, 0, size, size)
    const cx = size / 2, cy = size / 2
    for (let i = 0; i < 24; i++) {
      const th = (i / 24) * Math.PI * 2
      const r1 = i % 3 === 0 ? size / 2 - 4  : size / 2 - 6
      const r2 = i % 3 === 0 ? size / 2 - 14 : size / 2 - 12
      const x1 = cx + Math.cos(th) * r1, y1 = cy + Math.sin(th) * r1
      const x2 = cx + Math.cos(th) * r2, y2 = cy + Math.sin(th) * r2
      g.strokeStyle = i % 3 === 0 ? 'rgba(255,90,110,0.9)' : 'rgba(255,90,110,0.35)'
      g.lineWidth = i % 3 === 0 ? 2 : 1.2
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke()
    }
  }, [])

  // ── Music: auto-start on mount, retry on first user gesture if the
  //    browser blocks autoplay. Stops on unmount.
  const toggleMusic = () => {
    if (musicOn) { stopDuelMusic(); setMusicOn(false) }
    else         { startDuelMusic().then(() => setMusicOn(true)).catch(() => {/* still blocked */}) }
  }
  useEffect(() => {
    if (!duelConfig) return
    // Optimistic first attempt — works on desktop where mount often
    // follows a click (the "Accept" / "Challenge" button that got us here).
    let cancelled = false
    startDuelMusic()
      .then(() => { if (!cancelled && !isDuelMusicPlaying()) setMusicOn(false) })
      .catch(() => {
        // Autoplay blocked; retry once on the next real gesture.
        const retry = () => {
          startDuelMusic().then(() => setMusicOn(true)).catch(() => {})
          window.removeEventListener('pointerdown', retry)
          window.removeEventListener('keydown',     retry)
        }
        window.addEventListener('pointerdown', retry, { once: true })
        window.addEventListener('keydown',     retry, { once: true })
      })
    return () => {
      cancelled = true
      stopDuelMusic()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duelConfig?.duelId])

  // ── Leave-on-unmount forfeit ─────────────────────────────────────────
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    // If a previous mount scheduled a leave, cancel it — this is a re-mount.
    const w = window as any
    if (w.__duelLeaveTimer) { clearTimeout(w.__duelLeaveTimer); w.__duelLeaveTimer = null }
    return () => {
      if (!duelConfig) return
      // Debounce so React 18 StrictMode double-mount doesn't forfeit instantly.
      w.__duelLeaveTimer = setTimeout(() => {
        const stillActive = useGameStore.getState().activeDuelConfig?.duelId === duelConfig.duelId
        if (stillActive) sendWsEvent('duel.leave', { duel_id: duelConfig.duelId })
      }, 400)
      leaveTimerRef.current = w.__duelLeaveTimer
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duelConfig?.duelId])

  if (!cfg) return null

  const meHpPct  = meHp.max  > 0 ? Math.max(0, meHp.hp  / meHp.max)  : 0
  const foeHpPct = foeHp.max > 0 ? Math.max(0, foeHp.hp / foeHp.max) : 0

  return (
    <div className={s.screen}>
      {isBanned && bannedUntil != null && (
        <BanOverlay bannedUntilMs={bannedUntil} reason={bannedReason} />
      )}

      {/* TOP HUD */}
      <div className={s.top}>
        <button
          type="button"
          className={s.musicBtn}
          onClick={toggleMusic}
          title={musicOn ? 'Mute battle music' : 'Play battle music'}
        >
          {musicOn ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" fillOpacity=".25"/>
              <path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" fillOpacity=".25"/>
              <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          )}
        </button>
        <span className={s.bolt}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>
        </span>
        <div className={s.side}>
          <span className={s.tag}>{t('duel.you')}</span>
          <div className={s.bar}><div className={`${s.fill} ${s.fillMe}`} style={{ width: `${meHpPct * 100}%` }} /></div>
          <span className={s.hpn}>{Math.max(0, Math.ceil(meHp.hp))}</span>
        </div>
        <span className={`${s.vs} ${s.mono}`}>VS</span>
        <div className={`${s.side} ${s.sideFoe}`}>
          <span className={`${s.tag} ${s.tagFoe}`}>{cfg.opponentName}</span>
          <div className={s.bar}><div className={`${s.fill} ${s.fillFoe}`} style={{ width: `${foeHpPct * 100}%` }} /></div>
          <span className={s.hpn}>{Math.max(0, Math.ceil(foeHp.hp))}</span>
        </div>
        <span className={s.ava}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="6" width="18" height="13" rx="2"/><path d="M7 6V4h10v2"/>
          </svg>
        </span>
      </div>

      {/* ARENA — Phaser canvas mounts inside */}
      <div className={s.arena} ref={containerRef}>
        <div className={`${s.laneLbl} ${s.lblYou} ${s.mono}`}>YOU</div>
        <div className={`${s.laneLbl} ${s.lblFoe2} ${s.mono}`}>FOE</div>
        <div className={`${s.vbar} ${s.vbarMe}`}><div className={`${s.vfill} ${s.vfillMe}`} style={{ height: `${meHpPct * 100}%` }} /></div>
        <div className={`${s.vbar} ${s.vbarFoe}`}><div className={`${s.vfill} ${s.vfillFoe}`} style={{ height: `${foeHpPct * 100}%` }} /></div>
        <div className={`${s.hint} ${s.mono}`}>{t('duel.hint')}</div>
      </div>

      {/* CONTROLS */}
      <div className={s.controls}>
        <div className={s.dpad}>
          <button className={s.du} onPointerDown={() => startDpad('up')}    onPointerUp={() => stopDpad('up')}    onPointerLeave={() => stopDpad('up')}    onPointerCancel={() => stopDpad('up')}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5l7 9H5z"/></svg>
          </button>
          <button className={s.dl} onPointerDown={() => startDpad('left')}  onPointerUp={() => stopDpad('left')}  onPointerLeave={() => stopDpad('left')}  onPointerCancel={() => stopDpad('left')}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 12l9-7v14z"/></svg>
          </button>
          <button className={s.dr} onPointerDown={() => startDpad('right')} onPointerUp={() => stopDpad('right')} onPointerLeave={() => stopDpad('right')} onPointerCancel={() => stopDpad('right')}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 12l-9 7V5z"/></svg>
          </button>
          <button className={s.dd} onPointerDown={() => startDpad('down')}  onPointerUp={() => stopDpad('down')}  onPointerLeave={() => stopDpad('down')}  onPointerCancel={() => stopDpad('down')}>
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 19l-7-9h14z"/></svg>
          </button>
        </div>

        <div
          className={s.aim}
          ref={aimRef}
          onPointerDown={onAimDown}
          onPointerMove={onAimMove}
          onPointerUp={onAimUp}
        >
          <canvas className={s.ticks} ref={ticksRef} />
          <div className={s.ringPulse} />
          <div className={s.needle} style={{ transform: `rotate(${aimAngle}deg)` }}>
            <div className={s.stick} /><div className={s.tip} />
          </div>
          <div className={s.core} />
        </div>
      </div>

      {/* Overlays */}
      {countdown && (
        <DuelCountdownOverlay opponentName={cfg.opponentName} onDone={() => setCountdown(false)} />
      )}

      {result && (
        <div className={s.resultOverlay}>
          <div
            className={s.resultCard}
            style={{
              borderColor: result === 'win' ? '#39ff14' : '#ff4444',
              background:  result === 'win' ? '#001a00' : '#1a0000',
            }}
          >
            <div style={{ fontSize: 44 }}>{result === 'win' ? '🏆' : '💥'}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: result === 'win' ? '#39ff14' : '#ff4444' }}>
              {result === 'win' ? t('duel.win') : t('duel.lose')}
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
              {result === 'win'
                ? t('duel.wonPrize', { prize: (cfg.betAmount * 2 * 0.75).toFixed(cfg.currency === 'ton' ? 2 : 0), currency: cfg.currency === 'ton' ? 'GRAM' : '⬡' })
                : t('duel.lostBet',  { bet: cfg.betAmount, currency: cfg.currency === 'ton' ? 'GRAM' : '⬡' })
              }
            </div>
            <button
              className={s.resultBtn}
              onClick={() => { frozenCfgRef.current = null; clearDuel(); setScreen('duel') }}
            >
              {t('duel.playAgain')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
