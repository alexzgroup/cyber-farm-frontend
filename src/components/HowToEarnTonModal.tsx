import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getReferralRates } from '../api'
import type { ReferralRates, ReferralRatesLevel } from '../api/types'

interface Props {
  open: boolean
  onClose: () => void
}

export function HowToEarnTonModal({ open, onClose }: Props) {
  const { t } = useTranslation()
  const [rates, setRates] = useState<ReferralRates | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || rates) return
    setLoading(true)
    getReferralRates()
      .then(setRates)
      .catch(() => setRates(null))
      .finally(() => setLoading(false))
  }, [open, rates])

  if (!open) return null

  const levels: { n: number; l: ReferralRatesLevel | undefined }[] = [
    { n: 1, l: rates?.l1 },
    { n: 2, l: rates?.l2 },
    { n: 3, l: rates?.l3 },
  ]

  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <span style={s.title}>{t('referrals.modal.title')}</span>
          <button style={s.closeX} onClick={onClose} aria-label="close">×</button>
        </div>

        <div style={s.body}>
          <p style={s.intro}>{t('referrals.modal.intro')}</p>

          {loading && !rates ? (
            <div style={s.loading}>…</div>
          ) : (
            <>
              <Section
                title={t('referrals.modal.purchaseFirstTitle')}
                desc={t('referrals.modal.purchaseFirstDesc')}
                rows={levels.map(({ n, l }) => ({
                  label: t('referrals.modal.levelLabel', { n }),
                  value: l ? `${l.purchase_first_ton} ${t('referrals.modal.tonUnit')}` : '—',
                }))}
              />
              <Section
                title={t('referrals.modal.purchasePctTitle')}
                desc={t('referrals.modal.purchasePctDesc')}
                rows={levels.map(({ n, l }) => ({
                  label: t('referrals.modal.levelLabel', { n }),
                  value: l ? `${l.purchase_pct_of_ton}${t('referrals.modal.pctUnit')}` : '—',
                }))}
              />
              <Section
                title={t('referrals.modal.progressTitle')}
                desc={t('referrals.modal.progressDesc', {
                  raids: rates?.progress_min_raids ?? '—',
                  balance: rates?.progress_min_balance ?? '—',
                })}
                rows={levels.map(({ n, l }) => ({
                  label: t('referrals.modal.levelLabel', { n }),
                  value: l ? `${l.progress_ton} ${t('referrals.modal.tonUnit')}` : '—',
                }))}
              />
            </>
          )}
        </div>

        <button style={s.closeBtn} onClick={onClose}>
          {t('referrals.modal.close')}
        </button>
      </div>
    </div>
  )
}

interface SectionProps {
  title: string
  desc: string
  rows: { label: string; value: string }[]
}

function Section({ title, desc, rows }: SectionProps) {
  return (
    <div style={s.section}>
      <div style={s.sectionTitle}>{title}</div>
      <div style={s.sectionDesc}>{desc}</div>
      <div style={s.rowsGrid}>
        {rows.map((r) => (
          <div key={r.label} style={s.row}>
            <span style={s.rowLabel}>{r.label}</span>
            <span style={s.rowValue}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  modal: {
    width: '100%', maxWidth: 480, maxHeight: '88vh',
    background: '#0d1117', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    border: '1px solid rgba(56,189,248,0.2)', borderBottom: 'none',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    color: '#e2e8f0', fontFamily: 'monospace',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  title:   { fontSize: 15, fontWeight: 700, color: '#22d3ee', letterSpacing: 0.5 },
  closeX:  { background: 'none', border: 'none', color: '#64748b', fontSize: 24, cursor: 'pointer', padding: '0 4px', lineHeight: 1 },
  body:    { padding: '12px 18px 4px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 },
  intro:   { fontSize: 13, color: '#94a3b8', lineHeight: 1.5, margin: 0 },
  loading: { textAlign: 'center', padding: 24, color: '#64748b' },
  section: { display: 'flex', flexDirection: 'column', gap: 6 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#e2e8f0' },
  sectionDesc:  { fontSize: 11, color: '#64748b', lineHeight: 1.5 },
  rowsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 4 },
  row:      { background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' },
  rowLabel: { display: 'block', fontSize: 10, color: '#64748b', marginBottom: 2 },
  rowValue: { display: 'block', fontSize: 12, fontWeight: 700, color: '#22d3ee' },
  closeBtn: {
    margin: 14, padding: '11px', borderRadius: 10, border: 'none',
    background: 'rgba(56,189,248,0.15)', color: '#22d3ee',
    fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
}
