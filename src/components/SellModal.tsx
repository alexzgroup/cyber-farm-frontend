import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { createListing } from '../api'
import { fmtGold } from '../utils/format'
import styles from './SellModal.module.css'

interface Props {
  unitId:   number
  unitType: 'drone' | 'turret'
  unitName: string
  onClose:  () => void
  onSold:   () => void
}

export function SellModal({ unitId, unitType, unitName, onClose, onSold }: Props) {
  const { t }    = useTranslation()
  const balance  = useGameStore((s) => s.balance)
  const loadGameState = useGameStore((s) => s.loadGameState)

  const [price,    setPrice]    = useState('')
  const [currency, setCurrency] = useState<'gold' | 'ton'>('gold')
  const [busy,     setBusy]     = useState(false)
  const [error,    setError]    = useState('')

  const priceNum = parseFloat(price) || 0

  const handleSubmit = async () => {
    if (priceNum <= 0) { setError(t('sell.errorPrice')); return }
    setBusy(true)
    setError('')
    try {
      await createListing(unitType, unitId, priceNum, currency)
      await loadGameState()
      onSold()
    } catch (e: any) {
      setError(e?.message ?? t('sell.errorFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{t('sell.title')}</span>
          <button className={styles.close} onClick={onClose}>×</button>
        </div>

        <div className={styles.unitName}>{unitName}</div>

        {/* Currency selector */}
        <div className={styles.currencyRow}>
          {(['gold', 'ton'] as const).map(c => (
            <button
              key={c}
              className={`${styles.currBtn} ${currency === c ? styles.currActive : ''}`}
              style={currency === c ? { borderColor: c === 'ton' ? '#5b9cf6' : '#fbbf24', color: c === 'ton' ? '#5b9cf6' : '#fbbf24' } : {}}
              onClick={() => setCurrency(c)}
            >
              {c === 'gold' ? `⬡ ${t('sell.gold')}` : `◈ TON`}
            </button>
          ))}
        </div>

        {/* Price input */}
        <div className={styles.priceRow}>
          <label className={styles.label}>{t('sell.priceLabel')}</label>
          <div className={styles.inputWrap}>
            <span className={styles.inputIcon}>{currency === 'gold' ? '⬡' : '◈'}</span>
            <input
              type="number"
              className={styles.input}
              placeholder="0"
              min="1"
              value={price}
              onChange={e => setPrice(e.target.value)}
            />
          </div>
          {currency === 'gold' && priceNum > 0 && (
            <div className={styles.hint}>
              {t('sell.yourBalance')}: ⬡ {fmtGold(balance)}
            </div>
          )}
          {currency === 'ton' && priceNum > 0 && (
            <div className={styles.hint}>
              {t('sell.tonCommissionHint', {
                net: parseFloat((priceNum * 0.97).toFixed(4)),
                pct: '3%',
              })}
            </div>
          )}
          {currency === 'ton' && (
            <div className={styles.hintMuted}>
              {t('sell.tonPoolHint')}
            </div>
          )}
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button
          className={`${styles.submitBtn} ${busy ? styles.submitBusy : ''}`}
          onClick={handleSubmit}
          disabled={busy || priceNum <= 0}
        >
          {busy ? '...' : t('sell.submit')}
        </button>
      </div>
    </div>
  )
}
