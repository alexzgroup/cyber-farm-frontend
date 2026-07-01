import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { getPurchaseHistory } from '../api'
import type { ApiPurchaseLog } from '../api/types'
import { fmtGold } from '../utils/format'
import styles from './PurchaseHistoryScreen.module.css'

const ITEM_ICONS: Record<string, string> = {
  drone_buy:     '🤖',
  drone_upgrade: '⬆️',
  drone_equip:   '🔧',
  turret_buy:    '🛡',
  turret_equip:  '🔧',
}

const ITEM_LABELS: Record<string, string> = {
  drone_buy:     'Покупка дрона',
  drone_upgrade: 'Апгрейд дрона',
  drone_equip:   'Оснащение дрона',
  turret_buy:    'Покупка башни',
  turret_equip:  'Оснащение башни',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export function PurchaseHistoryScreen() {
  const { t } = useTranslation()
  const setScreen = useGameStore((s) => s.setScreen)
  const [logs, setLogs]       = useState<ApiPurchaseLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPurchaseHistory()
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => setScreen('equipment')}>
          {t('common.back')}
        </button>
        <h2 className={styles.title}>{t('purchases.title')}</h2>
      </div>

      {loading ? (
        <div className={styles.empty}>{t('app.loading')}</div>
      ) : logs.length === 0 ? (
        <div className={styles.empty}>{t('purchases.empty')}</div>
      ) : (
        <div className={styles.list}>
          {logs.map((log) => (
            <div key={log.id} className={styles.row}>
              <span className={styles.icon}>{ITEM_ICONS[log.item_type] ?? '📦'}</span>
              <div className={styles.info}>
                <div className={styles.name}>
                  {log.upgrade_name || ITEM_LABELS[log.item_type]}
                  {log.level > 0 && (
                    <span className={styles.level}> LV{log.level}</span>
                  )}
                </div>
                <div className={styles.unit}>{log.unit_name}</div>
                <div className={styles.date}>{formatDate(log.created_at)}</div>
              </div>
              <div className={styles.cost}>−{fmtGold(log.cost)} ⬡</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
