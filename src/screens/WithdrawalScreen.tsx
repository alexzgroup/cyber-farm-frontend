import { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { getWithdrawals, requestWithdrawal } from '../api'
import type { ApiWithdrawal, ApiWithdrawalsResponse, WithdrawalStatus } from '../api/types'
import styles from './WithdrawalScreen.module.css'

function statusLabel(s: WithdrawalStatus): string {
  switch (s) {
    case 'pending':      return 'На рассмотрении'
    case 'completed':    return 'Выполнен'
    case 'rejected':     return 'Отклонён'
    case 'failed':       return 'Ошибка'
    case 'pending_sign': return 'Ожидает подписи'
    default:             return s
  }
}

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
  const setScreen   = useGameStore((s) => s.setScreen)
  const tonBalance  = useGameStore((s) => s.tonBalance)
  const tonWallet   = useGameStore((s) => s.tonWallet)
  const loadGameState = useGameStore((s) => s.loadGameState)

  const [data,       setData]       = useState<ApiWithdrawalsResponse | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [amount,     setAmount]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null)

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
  const canSubmit  = numAmount >= minAmount && numAmount <= tonBalance && !submitting && !hasPending && !!tonWallet

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await requestWithdrawal(numAmount)
      showToast('Заявка на вывод создана', true)
      setAmount('')
      load()
      loadGameState()
    } catch (e: unknown) {
      const msg = (e as Error).message ?? ''
      if (msg.includes('pending'))     showToast('У вас уже есть активная заявка', false)
      else if (msg.includes('wallet')) showToast('Кошелёк не подключён', false)
      else if (msg.includes('balance')) showToast('Недостаточно TON', false)
      else                              showToast('Ошибка при создании заявки', false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.back} onClick={() => setScreen('profile')}>←</button>
        <span className={styles.title}>Вывод TON</span>
      </div>

      {toast && (
        <div className={`${styles.toast} ${toast.ok ? styles.toastOk : styles.toastErr}`}>
          {toast.msg}
        </div>
      )}

      {/* Balance row */}
      <div className={styles.balanceRow}>
        <span className={styles.balLabel}>Доступно</span>
        <span className={styles.balVal}>◈ {fmtTon(tonBalance)} TON</span>
      </div>

      {/* Wallet */}
      {tonWallet ? (
        <div className={styles.walletRow}>
          <span className={styles.walletLabel}>Кошелёк</span>
          <span className={styles.walletAddr}>{tonWallet.slice(0,8)}…{tonWallet.slice(-6)}</span>
        </div>
      ) : (
        <div className={styles.noWallet}>
          ⚠️ Кошелёк не подключён. Подключите в профиле.
        </div>
      )}

      {/* Form */}
      {tonWallet && (
        <div className={styles.form}>
          <div className={styles.formLabel}>Сумма вывода (TON)</div>
          <input
            className={styles.input}
            type="number"
            min={minAmount}
            step="0.01"
            placeholder={`Минимум ${minAmount} TON`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          {numAmount > 0 && (
            <div className={styles.breakdown}>
              <div className={styles.brow}>
                <span>Запрошено</span>
                <span>◈ {fmtTon(numAmount)} TON</span>
              </div>
              <div className={styles.brow}>
                <span>Комиссия ({Math.round(commission * 100)}%)</span>
                <span style={{ color: '#f59e0b' }}>− ◈ {fmtTon(fee)} TON</span>
              </div>
              <div className={`${styles.brow} ${styles.browTotal}`}>
                <span>Вы получите</span>
                <span style={{ color: '#22c55e' }}>◈ {fmtTon(payout)} TON</span>
              </div>
            </div>
          )}

          {hasPending && (
            <div className={styles.warn}>У вас уже есть заявка на рассмотрении</div>
          )}

          <button
            className={`${styles.btn} ${!canSubmit ? styles.btnDisabled : ''}`}
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {submitting ? 'Отправка…' : 'Запросить вывод'}
          </button>

          <div className={styles.hint}>
            Вывод обрабатывается вручную администратором. Обычно в течение 24 часов.
          </div>
        </div>
      )}

      {/* History */}
      <div className={styles.historyTitle}>История выводов</div>

      {loading ? (
        <div className={styles.empty}>Загрузка…</div>
      ) : !data?.withdrawals.length ? (
        <div className={styles.empty}>Заявок пока нет</div>
      ) : (
        <div className={styles.list}>
          {data.withdrawals.map((w) => (
            <WithdrawalRow key={w.id} w={w} />
          ))}
        </div>
      )}
    </div>
  )
}

function WithdrawalRow({ w }: { w: ApiWithdrawal }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowLeft}>
        <div className={styles.rowAmount}>◈ {fmtTon(w.amount)} TON</div>
        <div className={styles.rowSub}>
          выплата {fmtTon(w.payout)} · {fmtDate(w.created_at)}
        </div>
      </div>
      <div className={styles.rowStatus} style={{ color: statusColor(w.status) }}>
        {statusLabel(w.status)}
      </div>
    </div>
  )
}
