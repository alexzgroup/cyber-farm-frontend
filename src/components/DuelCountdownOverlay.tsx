import { useEffect, useState } from 'react'
import { soundManager } from '../game/utils/soundManager'

interface Props { opponentName: string; onDone: () => void }

type Phase = '3' | '2' | '1' | 'fight' | 'done'

export function DuelCountdownOverlay({ opponentName, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>('3')

  useEffect(() => {
    soundManager.beep(false)

    const t1 = setTimeout(() => { setPhase('2'); soundManager.beep(false) }, 1000)
    const t2 = setTimeout(() => { setPhase('1'); soundManager.beep(false) }, 2000)
    const t3 = setTimeout(() => { setPhase('fight'); soundManager.fight()  }, 3000)
    const t4 = setTimeout(() => { setPhase('done'); onDone()              }, 4200)

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'done') return null

  const isFight = phase === 'fight'

  return (
    <div style={styles.overlay}>
      {/* Opponent name */}
      <div style={styles.vs}>
        <span style={styles.you}>ВЫ</span>
        <span style={styles.vsWord}>VS</span>
        <span style={styles.opponent}>{opponentName}</span>
      </div>

      {/* Count or FIGHT */}
      <div
        key={phase}
        style={{
          ...styles.count,
          color:     isFight ? '#39ff14' : '#00e5ff',
          fontSize:  isFight ? 56 : 88,
          animation: 'duelPop 0.35s cubic-bezier(0.17,0.67,0.55,1.4) both',
        }}
      >
        {isFight ? 'FIGHT!' : phase}
      </div>

      {/* Dots progress */}
      <div style={styles.dots}>
        {(['3', '2', '1'] as const).map((p) => (
          <div
            key={p}
            style={{
              ...styles.dot,
              background: p >= phase && !isFight ? '#00e5ff' : 'rgba(255,255,255,0.15)',
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes duelPop {
          from { transform: scale(0.3); opacity: 0 }
          to   { transform: scale(1);   opacity: 1 }
        }
      `}</style>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'absolute', inset: 0, zIndex: 40,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 24,
    background: 'rgba(5,10,18,0.92)',
    fontFamily: 'monospace',
  },
  vs: {
    display: 'flex', alignItems: 'center', gap: 16,
  },
  you: {
    fontSize: 20, fontWeight: 700, color: '#00e5ff', letterSpacing: 2,
  },
  vsWord: {
    fontSize: 14, color: '#475569', fontWeight: 700,
  },
  opponent: {
    fontSize: 20, fontWeight: 700, color: '#ff4444', letterSpacing: 1,
  },
  count: {
    fontWeight: 900, letterSpacing: 4, textShadow: '0 0 30px currentColor',
    lineHeight: 1,
  },
  dots: {
    display: 'flex', gap: 8,
  },
  dot: {
    width: 10, height: 10, borderRadius: '50%', transition: 'background 0.3s',
  },
}
