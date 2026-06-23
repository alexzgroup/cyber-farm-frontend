import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'

interface Props {
  activeTab:  'duel' | 'raids'
  onHistory:  () => void
}

export function PvPHeader({ activeTab, onHistory }: Props) {
  const { t }       = useTranslation()
  const setScreen   = useGameStore((s) => s.setScreen)

  return (
    <div style={s.wrap}>
      <div style={s.tabs}>
        <button
          style={{ ...s.tab, ...(activeTab === 'duel' ? s.tabActive : {}) }}
          onClick={() => activeTab !== 'duel' && setScreen('duel')}
        >
          ⚔️ {t('duel.title')}
        </button>
        <button
          style={{ ...s.tab, ...(activeTab === 'raids' ? s.tabActiveRaids : {}) }}
          onClick={() => activeTab !== 'raids' && setScreen('raids')}
        >
          💥 {t('nav.raids')}
        </button>
      </div>
      <button style={s.histBtn} onClick={onHistory}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        {t('raids.historyBtn')}
      </button>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid #1e293b',
    flexShrink: 0,
    padding: '0 12px',
    gap: 4,
  },
  tabs: {
    display: 'flex',
    flex: 1,
  },
  tab: {
    flex: 1,
    padding: '12px 0',
    fontSize: 13,
    fontWeight: 600,
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#475569',
    cursor: 'pointer',
    fontFamily: 'monospace',
    letterSpacing: 0.3,
    transition: 'color 0.15s',
  },
  tabActive: {
    color: '#00e5ff',
    borderBottomColor: '#00e5ff',
    cursor: 'default',
  },
  tabActiveRaids: {
    color: '#ff6b35',
    borderBottomColor: '#ff6b35',
    cursor: 'default',
  },
  histBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    background: 'rgba(0,229,255,0.08)',
    border: '1px solid rgba(0,229,255,0.2)',
    borderRadius: 8,
    padding: '5px 10px',
    cursor: 'pointer',
    color: '#00e5ff',
    fontSize: 12,
    fontWeight: 700,
    fontFamily: 'monospace',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
}
