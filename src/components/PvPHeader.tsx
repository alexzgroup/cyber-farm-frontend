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
      <button style={s.favBtn} title={t('favorites.title')} onClick={() => setScreen('favorites')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>
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
  favBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,61,127,0.08)',
    border: '1px solid rgba(255,61,127,0.3)',
    borderRadius: 8,
    padding: '5px 8px',
    cursor: 'pointer',
    color: '#ff3d7f',
    flexShrink: 0,
  },
}
