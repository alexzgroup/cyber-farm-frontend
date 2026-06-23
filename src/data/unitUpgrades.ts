export interface UpgradeTemplate {
  id: string
  name: string
  icon: string
  description: string
  maxLevel: number
  costs: number[]
  bonusPerLevel: string
  category: 'drone' | 'turret'
}

// 10-level exponential cost curve (~×1.28 per step).
// Mirrors backend handler/equipment.go price tables exactly.
export const DRONE_UPGRADE_TEMPLATES: UpgradeTemplate[] = [
  {
    id: 'cargo',
    name: 'Грузовой отсек',
    icon: '📦',
    description: 'Расширяет вместимость — больший пассивный доход',
    maxLevel: 10,
    costs: [100, 130, 165, 210, 270, 345, 440, 565, 720, 925],
    bonusPerLevel: '+15% дохода/ч',
    category: 'drone',
  },
  {
    id: 'stealth',
    name: 'Стелс-модуль',
    icon: '👁',
    description: 'Снижает шанс обнаружения в рейдах',
    maxLevel: 10,
    costs: [150, 190, 245, 315, 405, 515, 660, 845, 1080, 1385],
    bonusPerLevel: '-10% шанс поломки',
    category: 'drone',
  },
  {
    id: 'energy',
    name: 'Энергоячейка',
    icon: '⚡',
    description: 'Усиленные аккумуляторы — больший бонус тапа',
    maxLevel: 10,
    costs: [120, 155, 200, 255, 325, 415, 530, 675, 865, 1105],
    bonusPerLevel: '+0.1 за тап',
    category: 'drone',
  },
  {
    id: 'ai',
    name: 'ИИ-навигация',
    icon: '🤖',
    description: 'Оптимизация маршрутов, дополнительная энергия',
    maxLevel: 10,
    costs: [80, 100, 130, 170, 215, 275, 350, 450, 575, 740],
    bonusPerLevel: '+1 макс. энергии',
    category: 'drone',
  },
  {
    id: 'armor',
    name: 'Силовая броня',
    icon: '🛡',
    description: 'Усиленный корпус — выше прочность в боях',
    maxLevel: 10,
    costs: [200, 255, 330, 420, 540, 690, 880, 1125, 1445, 1845],
    bonusPerLevel: '+20% защита',
    category: 'drone',
  },
]

export const TURRET_UPGRADE_TEMPLATES: UpgradeTemplate[] = [
  {
    id: 'targeting',
    name: 'Прицел',
    icon: '🎯',
    description: 'Точная наводка — попадания по всем целям',
    maxLevel: 10,
    costs: [120, 155, 200, 255, 325, 415, 530, 675, 865, 1105],
    bonusPerLevel: '+25% к точности',
    category: 'turret',
  },
  {
    id: 'firepower',
    name: 'Огневая мощь',
    icon: '💥',
    description: 'Усиленный заряд — больший урон атакующим',
    maxLevel: 10,
    costs: [150, 190, 245, 315, 405, 515, 660, 845, 1080, 1385],
    bonusPerLevel: '+30% к урону',
    category: 'turret',
  },
  {
    id: 'range',
    name: 'Дальнобойность',
    icon: '📡',
    description: 'Расширенный радиус обнаружения и поражения',
    maxLevel: 10,
    costs: [100, 130, 165, 210, 270, 345, 440, 565, 720, 925],
    bonusPerLevel: '+15% радиус',
    category: 'turret',
  },
  {
    id: 'reload',
    name: 'Перезарядка',
    icon: '⚙',
    description: 'Ускорение механизма подачи снарядов',
    maxLevel: 10,
    costs: [130, 165, 215, 275, 350, 445, 570, 730, 935, 1195],
    bonusPerLevel: '+20% скорость огня',
    category: 'turret',
  },
  {
    id: 'shield',
    name: 'Энергощит',
    icon: '🔮',
    description: 'Защитное силовое поле вокруг базы',
    maxLevel: 10,
    costs: [200, 255, 330, 420, 540, 690, 880, 1125, 1445, 1845],
    bonusPerLevel: '+15% защита базы',
    category: 'turret',
  },
]
