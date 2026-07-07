import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { createListing, getMarketFees, getRaidStats } from '../api'
import { fmtGold } from '../utils/format'
import { suggestPrice, sumUpgradeLevels, type PricingInput } from '../utils/marketPricing'
import styles from './SellModal.module.css'

const MIN_RAIDS_FOR_P2P = 10

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
  const drones   = useGameStore((s) => s.drones)
  const turrets  = useGameStore((s) => s.turrets)
  const unitUpgrades  = useGameStore((s) => s.unitUpgrades)
  const loadGameState = useGameStore((s) => s.loadGameState)

  const [price,    setPrice]    = useState('')
  const [currency, setCurrency] = useState<'gold' | 'ton'>('gold')
  const [busy,     setBusy]     = useState(false)
  const [error,    setError]    = useState('')
  const [limits,   setLimits]   = useState({
    min_gold: 100, max_gold: 100000, min_ton: 0.1, max_ton: 1000,
  })
  const [raidsTotal, setRaidsTotal] = useState<number | null>(null)

  // Suggested price — fair midpoint based on unit level + upgrade level sum.
  // Recomputed only when the unit changes (props are stable per modal open).
  const suggestion = useMemo(() => {
    const idStr = String(unitId)
    const upgSum = sumUpgradeLevels(unitUpgrades[idStr])
    if (unitType === 'drone') {
      const d = drones.find(x => x.id === idStr)
      if (!d) return null
      const input: PricingInput = { type: 'drone', level: d.level, droneType: d.droneType, upgradeLevelSum: upgSum }
      return suggestPrice(input)
    }
    const tt = turrets.find(x => x.id === idStr)
    if (!tt) return null
    return suggestPrice({ type: 'turret', level: tt.level, upgradeLevelSum: upgSum })
  }, [unitId, unitType, drones, turrets, unitUpgrades])

  useEffect(() => {
    getMarketFees()
      .then(f => setLimits({ min_gold: f.min_gold, max_gold: f.max_gold, min_ton: f.min_ton, max_ton: f.max_ton }))
      .catch(() => {})
    getRaidStats()
      .then(s => setRaidsTotal(s.total))
      .catch(() => setRaidsTotal(0))
  }, [])

  const isLocked = raidsTotal !== null && raidsTotal < MIN_RAIDS_FOR_P2P

  const priceNum = parseFloat(price) || 0
  const minPrice = currency === 'ton' ? limits.min_ton  : limits.min_gold
  const maxPrice = currency === 'ton' ? limits.max_ton  : limits.max_gold
  const outOfRange = priceNum > 0 && (priceNum < minPrice || priceNum > maxPrice)

  const handleSubmit = async () => {
    if (priceNum <= 0) { setError(t('sell.errorPrice')); return }
    if (priceNum < minPrice) {
      setError(t('sell.errorMin', { min: minPrice, currency: currency === 'ton' ? 'TON' : '⬡' }))
      return
    }
    if (priceNum > maxPrice) {
      setError(t('sell.errorMax', { max: maxPrice, currency: currency === 'ton' ? 'TON' : '⬡' }))
      return
    }
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

        {isLocked ? (
          <div className={styles.locked}>
            <div className={styles.lockedIcon}>🔒</div>
            <div className={styles.lockedTitle}>{t('sell.lockedTitle')}</div>
            <div className={styles.lockedText}>
              {t('sell.lockedDesc', { needed: MIN_RAIDS_FOR_P2P, have: raidsTotal ?? 0 })}
            </div>
            <div className={styles.lockedMotivation}>{t('sell.lockedMotivation')}</div>
            <button className={styles.submitBtn} onClick={onClose}>
              {t('sell.lockedCta')}
            </button>
          </div>
        ) : (
        <>

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
          <div className={styles.hintMuted}>
            {t('sell.range', {
              min: minPrice,
              max: maxPrice,
              currency: currency === 'ton' ? 'TON' : '⬡',
            })}
          </div>
          {suggestion && (
            <div className={styles.suggestionRow}>
              <span className={styles.suggestionLabel}>{t('sell.suggested')}</span>
              <span className={styles.suggestionValue} style={{ color: currency === 'ton' ? '#5b9cf6' : '#fbbf24' }}>
                {currency === 'ton'
                  ? `◈ ${suggestion.ton.toFixed(4)} TON`
                  : `⬡ ${fmtGold(suggestion.gold)}`}
              </span>
              <button
                type="button"
                className={styles.suggestionApply}
                onClick={() => setPrice(String(currency === 'ton' ? suggestion.ton : suggestion.gold))}
              >
                {t('sell.suggestedApply')}
              </button>
            </div>
          )}
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
          disabled={busy || priceNum <= 0 || outOfRange}
        >
          {busy ? '...' : t('sell.submit')}
        </button>
        </>
        )}
      </div>
    </div>
  )
}
