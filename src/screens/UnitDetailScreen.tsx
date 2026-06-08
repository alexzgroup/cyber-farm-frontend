import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore, type Drone, type Turret } from '../store/gameStore'
import { fmtGold } from '../utils/format'
import { DRONE_UPGRADE_TEMPLATES, TURRET_UPGRADE_TEMPLATES, type UpgradeTemplate } from '../data/unitUpgrades'
import { UnitPreviewGame } from '../game/UnitPreviewGame'
import styles from './UnitDetailScreen.module.css'

const DRONE_TYPE_KEYS: Record<number, string> = { 1: 'drone.scout', 2: 'drone.combat', 3: 'drone.stealth' }
const TURRET_LEVEL_KEYS: Record<number, string> = { 1: 'turret.light', 2: 'turret.medium', 3: 'turret.heavy' }

const DRONE_TYPE_COLORS: Record<number, string> = {
  1: '#00ccee', 2: '#ff4400', 3: '#9900ff',
}
const TURRET_LEVEL_COLORS: Record<number, string> = {
  1: '#00cc44', 2: '#ffaa00', 3: '#ff4400',
}

function LevelPips({ current, max }: { current: number; max: number }) {
  return (
    <div className={styles.pips}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`${styles.pip} ${i < current ? styles.pipFilled : ''}`} />
      ))}
    </div>
  )
}

function UpgradeRow({
  template, currentLevel, canAfford, accentColor, onBuy,
}: {
  template: UpgradeTemplate
  currentLevel: number
  canAfford: boolean
  accentColor: string
  onBuy: () => void
}) {
  const { t } = useTranslation()
  const nextLevel = currentLevel + 1
  const cost = currentLevel < template.maxLevel ? template.costs[currentLevel] : 0
  const maxed = currentLevel >= template.maxLevel

  return (
    <div className={styles.upgradeRow}>
      <div className={styles.upgradeIcon}>{template.icon}</div>
      <div className={styles.upgradeInfo}>
        <div className={styles.upgradeName}>{template.name}</div>
        <div className={styles.upgradeDesc}>{template.description}</div>
        <div className={styles.upgradeBonus} style={{ color: accentColor }}>
          {t('equipment.bonusLvl', {val: template.bonusPerLevel})}
        </div>
      </div>
      <div className={styles.upgradeRight}>
        <LevelPips current={currentLevel} max={template.maxLevel} />
        {maxed ? (
          <span className={styles.maxed} style={{ color: accentColor }}>MAX</span>
        ) : (
          <button
            className={`${styles.buyBtn} ${canAfford ? styles.buyActive : styles.buyDisabled}`}
            style={canAfford ? { borderColor: accentColor, color: accentColor } : {}}
            onClick={onBuy}
            disabled={!canAfford}
          >
            <span className={styles.buyLevel}>LV{nextLevel}</span>
            <span className={styles.buyPrice}>⬡ {cost}</span>
          </button>
        )}
      </div>
    </div>
  )
}

export function UnitDetailScreen() {
  const selectedUnitId      = useGameStore((s) => s.selectedUnitId)
  const drones              = useGameStore((s) => s.drones)
  const turrets             = useGameStore((s) => s.turrets)
  const unitUpgrades        = useGameStore((s) => s.unitUpgrades)
  const balance             = useGameStore((s) => s.balance)
  const purchaseUnitUpgrade = useGameStore((s) => s.purchaseUnitUpgrade)
  const setScreen           = useGameStore((s) => s.setScreen)
  const { t }               = useTranslation()

  const drone  = drones.find((d) => d.id === selectedUnitId)
  const turret = turrets.find((tt) => tt.id === selectedUnitId)
  const shouldRedirect = !selectedUnitId || (!drone && !turret)

  useEffect(() => {
    if (shouldRedirect) setScreen('equipment')
  }, [shouldRedirect, setScreen])

  if (shouldRedirect) return null

  const isDrone = Boolean(drone)
  const unit    = (drone ?? turret) as Drone | Turret
  const unitIdx = isDrone
    ? drones.findIndex((d) => d.id === selectedUnitId)
    : turrets.findIndex((t) => t.id === selectedUnitId)

  const templates  = isDrone ? DRONE_UPGRADE_TEMPLATES : TURRET_UPGRADE_TEMPLATES
  const upgrades   = unitUpgrades[selectedUnitId] ?? {}

  const accentColor = isDrone
    ? DRONE_TYPE_COLORS[(unit as Drone).droneType] ?? '#00e5ff'
    : TURRET_LEVEL_COLORS[(unit as Turret).level] ?? '#00cc44'

  const unitName = isDrone
    ? `${t(DRONE_TYPE_KEYS[(unit as Drone).droneType] ?? 'drone.scout')} #${unitIdx + 1}`
    : `${t(TURRET_LEVEL_KEYS[(unit as Turret).level] ?? 'turret.light')} #${unitIdx + 1}`

  const levelLabel = isDrone
    ? `LVL ${(unit as Drone).level}${(unit as Drone).isBroken ? ('  ' + t('common.broken')) : ''}`
    : `DEF LV${(unit as Turret).level}`

  const previewUnit = isDrone
    ? {
        kind: 'drone' as const,
        droneType: (unit as Drone).droneType as 1 | 2 | 3,
        droneLevel: (unit as Drone).level,
        isBroken: (unit as Drone).isBroken,
      }
    : {
        kind: 'turret' as const,
        turretLevel: (unit as Turret).level as 1 | 2 | 3,
      }

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.header} style={{ borderBottomColor: accentColor + '33' }}>
        <button className={styles.backBtn} style={{ borderColor: accentColor + '66', color: accentColor }}
          onClick={() => setScreen('equipment')}>
          {t('common.back')}
        </button>
        <div>
          <div className={styles.unitName}>{unitName}</div>
          <div className={styles.unitLevel} style={{ color: accentColor }}>{levelLabel}</div>
        </div>
        <div className={styles.balance}>⬡ {fmtGold(balance)}</div>
      </div>

      {/* Preview */}
      <div className={styles.previewWrap}>
        <UnitPreviewGame unit={previewUnit} width={320} height={240} />
      </div>

      {/* Stat summary */}
      <div className={styles.statBar} style={{ borderColor: accentColor + '33' }}>
        {templates.map((t) => {
          const lv = upgrades[t.id] ?? 0
          return (
            <div key={t.id} className={styles.statItem}>
              <span className={styles.statIcon}>{t.icon}</span>
              <span className={styles.statLevel} style={{ color: lv > 0 ? accentColor : '#444' }}>
                {lv}/{t.maxLevel}
              </span>
            </div>
          )
        })}
      </div>

      {/* Upgrades list */}
      <div className={styles.upgradesList}>
        <div className={styles.upgradesHeader}>{t('unitDetail.upgrades')}</div>
        {templates.map((template) => {
          const currentLevel = upgrades[template.id] ?? 0
          const cost = currentLevel < template.maxLevel ? template.costs[currentLevel] : 0
          const canAfford = balance >= cost && currentLevel < template.maxLevel

          return (
            <UpgradeRow
              key={template.id}
              template={template}
              currentLevel={currentLevel}
              canAfford={canAfford}
              accentColor={accentColor}
              onBuy={() => void purchaseUnitUpgrade(selectedUnitId, template.id, cost)}
            />
          )
        })}
      </div>
    </div>
  )
}
