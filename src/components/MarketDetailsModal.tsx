import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { DRONE_UPGRADE_TEMPLATES, TURRET_UPGRADE_TEMPLATES, type UpgradeTemplate } from '../data/unitUpgrades'
import { DroneIcon, TurretIcon, UnitCircle } from './UnitIcons'
import type { ApiMarketListing } from '../api/types'
import styles from './MarketDetailsModal.module.css'

// Go serialises upgrade types as snake_case strings; local templates use short
// ids for compactness. This maps API → template id.
const DRONE_TYPE_TO_TEMPLATE: Record<string, string> = {
  cargo_bay:       'cargo',
  stealth_module:  'stealth',
  energy_cell:     'energy',
  ai_navigation:   'ai',
  armor:           'armor',
}
const TURRET_TYPE_TO_TEMPLATE: Record<string, string> = {
  scope:      'targeting',
  firepower:  'firepower',
  range:      'range',
  reload:     'reload',
  shield:     'shield',
}

const DRONE_META: Record<string, { color: string; nameKey: string }> = {
  scout:   { color: '#00ccee', nameKey: 'drone.scout'   },
  combat:  { color: '#ff4400', nameKey: 'drone.combat'  },
  stealth: { color: '#9900ff', nameKey: 'drone.stealth' },
}
const TURRET_META: Record<number, { color: string; nameKey: string }> = {
  1: { color: '#00cc44', nameKey: 'turret.light'  },
  2: { color: '#ffaa00', nameKey: 'turret.medium' },
  3: { color: '#ff4400', nameKey: 'turret.heavy'  },
}

function Pips({ current, max, color }: { current: number; max: number; color: string }) {
  return (
    <div className={styles.pips}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={styles.pip}
          style={i < current ? { background: color, borderColor: color } : undefined}
        />
      ))}
    </div>
  )
}

function UpgradeRow({
  template, currentLevel, accentColor,
}: {
  template: UpgradeTemplate
  currentLevel: number
  accentColor: string
}) {
  return (
    <div className={styles.upgradeRow}>
      <div className={styles.upgradeIcon}>{template.icon}</div>
      <div className={styles.upgradeInfo}>
        <div className={styles.upgradeName}>{template.name}</div>
        <div className={styles.upgradeDesc}>{template.description}</div>
        <div className={styles.upgradeBonus} style={{ color: accentColor }}>
          {template.bonusPerLevel}
        </div>
      </div>
      <div className={styles.upgradeRight}>
        <Pips current={currentLevel} max={template.maxLevel} color={accentColor} />
        <span className={styles.upgradeLevelLabel} style={{ color: accentColor }}>
          LV{currentLevel}/{template.maxLevel}
        </span>
      </div>
    </div>
  )
}

export function MarketDetailsModal({
  item, onClose, footer,
}: {
  item: ApiMarketListing
  onClose: () => void
  footer?: React.ReactNode  // buy buttons passed from MarketScreen
}) {
  const { t } = useTranslation()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    // Lock body scroll while modal is open
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const isDrone = item.unit_type === 'drone'
  const turretLv = item.turret?.level ?? item.turret?.turret_level ?? 1
  const meta = isDrone
    ? (DRONE_META[item.drone?.drone_type ?? 'scout'] ?? DRONE_META.scout)
    : (TURRET_META[turretLv] ?? TURRET_META[1])

  const accentColor = meta.color
  const templates = isDrone ? DRONE_UPGRADE_TEMPLATES : TURRET_UPGRADE_TEMPLATES
  const typeMap = isDrone ? DRONE_TYPE_TO_TEMPLATE : TURRET_TYPE_TO_TEMPLATE

  // Fold API upgrades into { templateId → level }
  const rawUpgrades = isDrone ? item.drone?.upgrades : item.turret?.upgrades
  const upgradesByTemplate: Record<string, number> = {}
  for (const u of rawUpgrades ?? []) {
    const tid = typeMap[u.upgrade_type]
    if (tid) upgradesByTemplate[tid] = u.level ?? 0
  }
  const totalLevels = Object.values(upgradesByTemplate).reduce((s, v) => s + v, 0)

  const unitName = t(meta.nameKey)
  const levelLabel = isDrone
    ? `LVL ${item.drone?.level ?? 1}`
    : `DEF LV${turretLv}`

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ '--accent': accentColor } as React.CSSProperties}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitles}>
            <div className={styles.unitName}>{unitName}</div>
            <div className={styles.unitLevel} style={{ color: accentColor }}>{levelLabel}</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title={t('common.cancel')}>✕</button>
        </div>

        {/* Preview */}
        <div className={styles.preview}>
          <UnitCircle color={accentColor} size={96}>
            {isDrone
              ? <DroneIcon color={accentColor} size={52} />
              : <TurretIcon color={accentColor} level={turretLv as 1 | 2 | 3} size={52} />}
          </UnitCircle>
          <div className={styles.seller}>
            {t('market.seller', { name: item.seller?.username || item.seller?.first_name || '—' })}
          </div>
        </div>

        {/* Stat summary */}
        <div className={styles.statBar} style={{ borderColor: accentColor + '33' }}>
          {templates.map((tpl) => {
            const lv = upgradesByTemplate[tpl.id] ?? 0
            return (
              <div key={tpl.id} className={styles.statItem}>
                <span className={styles.statIcon}>{tpl.icon}</span>
                <span className={styles.statLevel} style={{ color: lv > 0 ? accentColor : '#3a4555' }}>
                  {lv}/{tpl.maxLevel}
                </span>
              </div>
            )
          })}
        </div>

        {/* Upgrades list */}
        <div className={styles.upgradesList}>
          <div className={styles.upgradesHeader}>
            {t('market.detailsUpgradesHeader')}
            {totalLevels > 0 && (
              <span className={styles.upgradesTotal} style={{ color: accentColor }}>
                · {t('market.upgrades', { count: totalLevels })}
              </span>
            )}
          </div>
          {totalLevels === 0 ? (
            <div className={styles.emptyUpg}>{t('market.detailsNoUpgrades')}</div>
          ) : (
            templates
              .filter(tpl => (upgradesByTemplate[tpl.id] ?? 0) > 0)
              .map((tpl) => (
                <UpgradeRow
                  key={tpl.id}
                  template={tpl}
                  currentLevel={upgradesByTemplate[tpl.id] ?? 0}
                  accentColor={accentColor}
                />
              ))
          )}
        </div>

        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  )
}
