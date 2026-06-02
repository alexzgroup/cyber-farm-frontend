export interface UpgradeTemplate {
  id: string
  name: string
  icon: string
  description: string
  maxLevel: 3
  costs: [number, number, number]
  bonusPerLevel: string
  category: 'drone' | 'turret'
}

export const DRONE_UPGRADE_TEMPLATES: UpgradeTemplate[] = [
  {
    id: 'cargo',
    name: 'Грузовой отсек',
    icon: '📦',
    description: 'Расширяет вместимость — больший пассивный доход',
    maxLevel: 3,
    costs: [100, 280, 600],
    bonusPerLevel: '+15% дохода/ч',
    category: 'drone',
  },
  {
    id: 'stealth',
    name: 'Стелс-модуль',
    icon: '👁',
    description: 'Снижает шанс обнаружения в рейдах',
    maxLevel: 3,
    costs: [150, 380, 800],
    bonusPerLevel: '-10% шанс поломки',
    category: 'drone',
  },
  {
    id: 'energy',
    name: 'Энергоячейка',
    icon: '⚡',
    description: 'Усиленные аккумуляторы — больший бонус тапа',
    maxLevel: 3,
    costs: [120, 300, 650],
    bonusPerLevel: '+0.1 за тап',
    category: 'drone',
  },
  {
    id: 'ai',
    name: 'ИИ-навигация',
    icon: '🤖',
    description: 'Оптимизация маршрутов, дополнительная энергия',
    maxLevel: 3,
    costs: [80, 220, 500],
    bonusPerLevel: '+1 макс. энергии',
    category: 'drone',
  },
  {
    id: 'armor',
    name: 'Силовая броня',
    icon: '🛡',
    description: 'Усиленный корпус — выше прочность в боях',
    maxLevel: 3,
    costs: [200, 480, 1000],
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
    maxLevel: 3,
    costs: [120, 300, 650],
    bonusPerLevel: '+25% к точности',
    category: 'turret',
  },
  {
    id: 'firepower',
    name: 'Огневая мощь',
    icon: '💥',
    description: 'Усиленный заряд — больший урон атакующим',
    maxLevel: 3,
    costs: [150, 380, 800],
    bonusPerLevel: '+30% к урону',
    category: 'turret',
  },
  {
    id: 'range',
    name: 'Дальнобойность',
    icon: '📡',
    description: 'Расширенный радиус обнаружения и поражения',
    maxLevel: 3,
    costs: [100, 260, 550],
    bonusPerLevel: '+15% радиус',
    category: 'turret',
  },
  {
    id: 'reload',
    name: 'Перезарядка',
    icon: '⚙',
    description: 'Ускорение механизма подачи снарядов',
    maxLevel: 3,
    costs: [130, 330, 700],
    bonusPerLevel: '+20% скорость огня',
    category: 'turret',
  },
  {
    id: 'shield',
    name: 'Энергощит',
    icon: '🔮',
    description: 'Защитное силовое поле вокруг базы',
    maxLevel: 3,
    costs: [200, 500, 1100],
    bonusPerLevel: '+15% защита базы',
    category: 'turret',
  },
]
