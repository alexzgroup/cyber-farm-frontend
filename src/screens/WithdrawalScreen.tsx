import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { getWithdrawals, requestWithdrawal } from '../api'
import type { ApiWithdrawal, ApiWithdrawalsResponse, WithdrawalStatus } from '../api/types'
import styles from './WithdrawalScreen.module.css'

function statusColor(s: WithdrawalStatus): string {
  switch (s) {
    case 'pending':      return '#f59e0b'
    case 'completed':    return '#22c55e'
    case 'rejected':
    case 'failed':       return '#ef4444'
    default:             return '#64748b'
  }
}

function fmtTon(n: number) { return n.toFixed(4) }

function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

export function WithdrawalScreen() {
  const { t } = useTranslation()
  const setScreen   = useGameStore((s) => s.setScreen)
  const tonBalance  = useGameStore((s) => s.tonBalance)
  const availableTon = useGameStore((s) => s.availableTonBalance)
  const tonLockDays = useGameStore((s) => s.tonLockDays)
  const tonWallet   = useGameStore((s) => s.tonWallet)
  const loadGameState = useGameStore((s) => s.loadGameState)
  const lockedTon   = Math.max(0, tonBalance - availableTon)

  const [data,       setData]       = useState<ApiWithdrawalsResponse | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [amount,     setAmount]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null)

  const statusLabel = (s: WithdrawalStatus): string => {
    switch (s) {
      case 'pending':      return t('withdrawal.statusPending')
      case 'completed':    return t('withdrawal.statusCompleted')
      case 'rejected':     return t('withdrawal.statusRejected')
      case 'failed':       return t('withdrawal.statusFailed')
      case 'pending_sign': return t('withdrawal.statusPendingSign')
      default:             return s
    }
  }

  const load = () => {
    setLoading(true)
    getWithdrawals()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const hasPending = data?.withdrawals.some((w) => w.status === 'pending') ?? false

  const numAmount  = parseFloat(amount) || 0
  const commission = data?.commission ?? 0.30
  const minAmount  = data?.min_amount ?? 1
  const fee        = numAmount * commission
  const payout     = numAmount - fee
  const canSubmit  = numAmount >= minAmount && numAmount <= availableTon && !submitting && !hasPending && !!tonWallet

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await requestWithdrawal(numAmount)
      showToast(t('withdrawal.toastCreated'), true)
      setAmount('')
      load()
      loadGameState()
    } catch (e: unknown) {
      const msg = (e as Error).message ?? ''
      if (msg.includes('pending'))      showToast(t('withdrawal.toastPending'),   false)
      else if (msg.includes('wallet'))  showToast(t('withdrawal.toastNoWallet'),  false)
      else if (msg.includes('balance')) showToast(t('withdrawal.toastNoBalance'), false)
      else                              showToast(t('withdrawal.toastError'),    false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.back} onClick={() => setScreen('profile')}>←</button>
        <span className={styles.title}>{t('withdrawal.title')}</span>
      </div>

      {toast && (
        <div className={`${styles.toast} ${toast.ok ? styles.toastOk : styles.toastErr}`}>
          {toast.msg}
        </div>
      )}

      {/* Balance row */}
      <div className={styles.balanceRow}>
        <span className={styles.balLabel}>{t('withdrawal.totalBalance')}</span>
        <span className={styles.balVal}>◈ {fmtTon(tonBalance)} TON</span>
      </div>
      <div className={styles.balanceRow}>
        <span className={styles.balLabel}>{t('withdrawal.available')}</span>
        <span className={styles.balVal} style={{ color: '#22c55e' }}>◈ {fmtTon(availableTon)} TON</span>
      </div>
      {lockedTon > 0.0001 && (
        <div className={styles.balanceRow}>
          <span className={styles.balLabel}>{t('withdrawal.locked', { days: tonLockDays })}</span>
          <span className={styles.balVal} style={{ color: '#f59e0b' }}>◈ {fmtTon(lockedTon)} TON</span>
        </div>
      )}

      {/* Wallet */}
      {tonWallet ? (
        <div className={styles.walletRow}>
          <span className={styles.walletLabel}>{t('withdrawal.wallet')}</span>
          <span className={styles.walletAddr}>{tonWallet.slice(0,8)}…{tonWallet.slice(-6)}</span>
        </div>
      ) : (
        <div className={styles.noWallet}>
          {t('withdrawal.noWalletWarn')}
        </div>
      )}

      {/* Form */}
      {tonWallet && (
        <div className={styles.form}>
          <div className={styles.formLabel}>{t('withdrawal.amountLabel')}</div>
          <input
            className={styles.input}
            type="number"
            min={minAmount}
            step="0.01"
            placeholder={t('withdrawal.minPlaceholder', { min: minAmount })}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          {numAmount > 0 && (
            <div className={styles.breakdown}>
              <div className={styles.brow}>
                <span>{t('withdrawal.requested')}</span>
                <span>◈ {fmtTon(numAmount)} TON</span>
              </div>
              <div className={styles.brow}>
                <span>{t('withdrawal.commission', { pct: Math.round(commission * 100) })}</span>
                <span style={{ color: '#f59e0b' }}>− ◈ {fmtTon(fee)} TON</span>
              </div>
              <div className={`${styles.brow} ${styles.browTotal}`}>
                <span>{t('withdrawal.youGet')}</span>
                <span style={{ color: '#22c55e' }}>◈ {fmtTon(payout)} TON</span>
              </div>
            </div>
          )}

          {/* 24h processing notice — shown above the submit button so the user
              agrees to the SLA before creating the request. Multilingual via i18n. */}
          <div className={styles.processingNotice} data-testid="withdrawal-24h-notice">
            <div className={styles.processingNoticeTitle}>{t('withdrawal.processingNoticeTitle')}</div>
            <div className={styles.processingNoticeBody}>{t('withdrawal.processingNoticeBody')}</div>
          </div>

          {hasPending && (
            <div className={styles.warn}>{t('withdrawal.hasPending')}</div>
          )}

          <button
            className={`${styles.btn} ${!canSubmit ? styles.btnDisabled : ''}`}
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {submitting ? t('withdrawal.submitting') : t('withdrawal.submit')}
          </button>

          <div className={styles.conditions}>
            <div className={styles.condRow}>
              <span>{t('withdrawal.commissionRow')}</span>
              <span>{Math.round(commission * 100)}%</span>
            </div>
            <div className={styles.condRow}>
              <span>{t('withdrawal.minAmountRow')}</span>
              <span>◈ {minAmount} TON</span>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      <div className={styles.historyTitle}>{t('withdrawal.historyTitle')}</div>

      {loading ? (
        <div className={styles.empty}>{t('withdrawal.loading')}</div>
      ) : !data?.withdrawals.length ? (
        <div className={styles.empty}>{t('withdrawal.empty')}</div>
      ) : (
        <div className={styles.list}>
          {data.withdrawals.map((w) => (
            <WithdrawalRow key={w.id} w={w} statusLabel={statusLabel} />
          ))}
        </div>
      )}
    </div>
  )
}

function WithdrawalRow({ w, statusLabel }: { w: ApiWithdrawal; statusLabel: (s: WithdrawalStatus) => string }) {
  const { t } = useTranslation()
  return (
    <div className={styles.row}>
      <div className={styles.rowLeft}>
        <div className={styles.rowAmount}>◈ {fmtTon(w.amount)} TON</div>
        <div className={styles.rowSub}>
          {t('withdrawal.rowPayout', { payout: fmtTon(w.payout) })} · {fmtDate(w.created_at)}
        </div>
      </div>
      <div className={styles.rowStatus} style={{ color: statusColor(w.status) }}>
        {statusLabel(w.status)}
      </div>
    </div>
  )
}
