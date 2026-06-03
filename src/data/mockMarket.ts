export interface MarketListing {
  id: string
  type: 'drone' | 'turret'
  droneType?: 1 | 2 | 3
  droneLevel?: number
  turretLevel?: 1 | 2 | 3
  upgradesCount: number
  price: number
  sellerName: string
  listedAt: number  // timestamp ms
}

const SELLERS = [
  'FarmBot_42', 'CryptoFarmer', 'TonKing99', 'DroneHunter_X',
  'CyberNomad_7', 'NanoRaider', 'SkyPirate', 'QuantumFarm',
  'SteelWing_01', 'GhostDrone', 'MegaFarmer', 'Alpha_Unit_9',
  'IronSky_Pro', 'ZeroGravity', 'DarkFarmer',
]

const now = Date.now()
const ago = (minutes: number) => now - minutes * 60_000

export const MOCK_MARKET: MarketListing[] = [
  // ── Дроны ──
  { id: 'm01', type: 'drone', droneType: 1, droneLevel: 1, upgradesCount: 0, price: 180,  sellerName: 'FarmBot_42',    listedAt: ago(2)   },
  { id: 'm02', type: 'drone', droneType: 2, droneLevel: 1, upgradesCount: 2, price: 240,  sellerName: 'CryptoFarmer',  listedAt: ago(5)   },
  { id: 'm03', type: 'drone', droneType: 3, droneLevel: 2, upgradesCount: 4, price: 680,  sellerName: 'TonKing99',     listedAt: ago(12)  },
  { id: 'm04', type: 'drone', droneType: 1, droneLevel: 3, upgradesCount: 9, price: 2400, sellerName: 'MegaFarmer',    listedAt: ago(30)  },
  { id: 'm05', type: 'drone', droneType: 2, droneLevel: 2, upgradesCount: 5, price: 890,  sellerName: 'GhostDrone',    listedAt: ago(45)  },
  { id: 'm06', type: 'drone', droneType: 3, droneLevel: 1, upgradesCount: 1, price: 210,  sellerName: 'SkyPirate',     listedAt: ago(60)  },
  { id: 'm07', type: 'drone', droneType: 1, droneLevel: 2, upgradesCount: 7, price: 1100, sellerName: 'ZeroGravity',   listedAt: ago(90)  },
  { id: 'm08', type: 'drone', droneType: 2, droneLevel: 3, upgradesCount: 12,price: 3200, sellerName: 'QuantumFarm',   listedAt: ago(120) },
  { id: 'm09', type: 'drone', droneType: 3, droneLevel: 2, upgradesCount: 3, price: 720,  sellerName: 'NanoRaider',    listedAt: ago(150) },
  { id: 'm10', type: 'drone', droneType: 1, droneLevel: 1, upgradesCount: 0, price: 160,  sellerName: 'DarkFarmer',    listedAt: ago(180) },
  { id: 'm11', type: 'drone', droneType: 2, droneLevel: 1, upgradesCount: 3, price: 290,  sellerName: 'IronSky_Pro',   listedAt: ago(200) },
  { id: 'm12', type: 'drone', droneType: 3, droneLevel: 3, upgradesCount: 11,price: 2800, sellerName: 'Alpha_Unit_9',  listedAt: ago(240) },
  { id: 'm13', type: 'drone', droneType: 1, droneLevel: 2, upgradesCount: 2, price: 550,  sellerName: 'SteelWing_01',  listedAt: ago(300) },
  { id: 'm14', type: 'drone', droneType: 2, droneLevel: 2, upgradesCount: 6, price: 950,  sellerName: 'DroneHunter_X', listedAt: ago(360) },
  { id: 'm15', type: 'drone', droneType: 3, droneLevel: 1, upgradesCount: 0, price: 195,  sellerName: 'CyberNomad_7',  listedAt: ago(420) },
  { id: 'm16', type: 'drone', droneType: 1, droneLevel: 3, upgradesCount: 8, price: 2100, sellerName: 'TonKing99',     listedAt: ago(480) },
  { id: 'm17', type: 'drone', droneType: 2, droneLevel: 1, upgradesCount: 1, price: 220,  sellerName: 'FarmBot_42',    listedAt: ago(540) },
  { id: 'm18', type: 'drone', droneType: 3, droneLevel: 2, upgradesCount: 5, price: 800,  sellerName: 'QuantumFarm',   listedAt: ago(600) },
  { id: 'm19', type: 'drone', droneType: 1, droneLevel: 1, upgradesCount: 4, price: 320,  sellerName: 'MegaFarmer',    listedAt: ago(700) },
  { id: 'm20', type: 'drone', droneType: 2, droneLevel: 3, upgradesCount: 10,price: 2950, sellerName: 'GhostDrone',    listedAt: ago(800) },
  { id: 'm21', type: 'drone', droneType: 3, droneLevel: 1, upgradesCount: 2, price: 230,  sellerName: 'SkyPirate',     listedAt: ago(900) },
  { id: 'm22', type: 'drone', droneType: 1, droneLevel: 2, upgradesCount: 6, price: 980,  sellerName: 'ZeroGravity',   listedAt: ago(1000)},
  { id: 'm23', type: 'drone', droneType: 2, droneLevel: 2, upgradesCount: 3, price: 640,  sellerName: 'NanoRaider',    listedAt: ago(1100)},
  { id: 'm24', type: 'drone', droneType: 3, droneLevel: 3, upgradesCount: 14,price: 3600, sellerName: 'Alpha_Unit_9',  listedAt: ago(1200)},
  { id: 'm25', type: 'drone', droneType: 1, droneLevel: 3, upgradesCount: 7, price: 1900, sellerName: 'IronSky_Pro',   listedAt: ago(1400)},
  { id: 'm26', type: 'drone', droneType: 2, droneLevel: 1, upgradesCount: 0, price: 175,  sellerName: 'DarkFarmer',    listedAt: ago(1600)},
  { id: 'm27', type: 'drone', droneType: 3, droneLevel: 2, upgradesCount: 8, price: 1250, sellerName: 'CryptoFarmer',  listedAt: ago(1800)},
  { id: 'm28', type: 'drone', droneType: 1, droneLevel: 1, upgradesCount: 3, price: 280,  sellerName: 'SteelWing_01',  listedAt: ago(2000)},
  { id: 'm29', type: 'drone', droneType: 2, droneLevel: 3, upgradesCount: 9, price: 2600, sellerName: 'DroneHunter_X', listedAt: ago(2400)},
  { id: 'm30', type: 'drone', droneType: 3, droneLevel: 1, upgradesCount: 5, price: 370,  sellerName: 'CyberNomad_7',  listedAt: ago(2800)},

  // ── Башни ──
  { id: 'm31', type: 'turret', turretLevel: 1, upgradesCount: 0, price: 220,  sellerName: 'FarmBot_42',    listedAt: ago(3)   },
  { id: 'm32', type: 'turret', turretLevel: 2, upgradesCount: 3, price: 580,  sellerName: 'TonKing99',     listedAt: ago(8)   },
  { id: 'm33', type: 'turret', turretLevel: 3, upgradesCount: 8, price: 1900, sellerName: 'MegaFarmer',    listedAt: ago(20)  },
  { id: 'm34', type: 'turret', turretLevel: 1, upgradesCount: 2, price: 290,  sellerName: 'GhostDrone',    listedAt: ago(50)  },
  { id: 'm35', type: 'turret', turretLevel: 2, upgradesCount: 6, price: 880,  sellerName: 'QuantumFarm',   listedAt: ago(80)  },
  { id: 'm36', type: 'turret', turretLevel: 3, upgradesCount: 12,price: 2800, sellerName: 'NanoRaider',    listedAt: ago(110) },
  { id: 'm37', type: 'turret', turretLevel: 1, upgradesCount: 1, price: 240,  sellerName: 'SkyPirate',     listedAt: ago(160) },
  { id: 'm38', type: 'turret', turretLevel: 2, upgradesCount: 4, price: 690,  sellerName: 'ZeroGravity',   listedAt: ago(220) },
  { id: 'm39', type: 'turret', turretLevel: 3, upgradesCount: 10,price: 2400, sellerName: 'Alpha_Unit_9',  listedAt: ago(310) },
  { id: 'm40', type: 'turret', turretLevel: 1, upgradesCount: 3, price: 310,  sellerName: 'IronSky_Pro',   listedAt: ago(400) },
  { id: 'm41', type: 'turret', turretLevel: 2, upgradesCount: 7, price: 1050, sellerName: 'DarkFarmer',    listedAt: ago(500) },
  { id: 'm42', type: 'turret', turretLevel: 3, upgradesCount: 9, price: 2200, sellerName: 'CryptoFarmer',  listedAt: ago(600) },
  { id: 'm43', type: 'turret', turretLevel: 1, upgradesCount: 0, price: 200,  sellerName: 'SteelWing_01',  listedAt: ago(750) },
  { id: 'm44', type: 'turret', turretLevel: 2, upgradesCount: 5, price: 820,  sellerName: 'DroneHunter_X', listedAt: ago(900) },
  { id: 'm45', type: 'turret', turretLevel: 3, upgradesCount: 14,price: 3400, sellerName: 'CyberNomad_7',  listedAt: ago(1100)},
  { id: 'm46', type: 'turret', turretLevel: 1, upgradesCount: 4, price: 350,  sellerName: 'FarmBot_42',    listedAt: ago(1400)},
  { id: 'm47', type: 'turret', turretLevel: 2, upgradesCount: 2, price: 520,  sellerName: 'TonKing99',     listedAt: ago(1800)},
  { id: 'm48', type: 'turret', turretLevel: 3, upgradesCount: 11,price: 2600, sellerName: 'MegaFarmer',    listedAt: ago(2200)},
  { id: 'm49', type: 'turret', turretLevel: 1, upgradesCount: 5, price: 380,  sellerName: 'GhostDrone',    listedAt: ago(2600)},
  { id: 'm50', type: 'turret', turretLevel: 2, upgradesCount: 9, price: 1300, sellerName: 'QuantumFarm',   listedAt: ago(3000)},
]

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return 'только что'
  if (m < 60) return `${m} мин назад`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ч назад`
  return `${Math.floor(h / 24)} д назад`
}
