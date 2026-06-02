export interface MockPlayer {
  id: string
  name: string
  balance: number
  defenseLevel: 1 | 2 | 3
  droneCount: number
  droneType?: 1 | 2 | 3
  turrets: Array<{ level: 1 | 2 | 3 }>   // sorted: strongest first
}

export const MOCK_PLAYERS: MockPlayer[] = [
  { id: 'p1',  name: 'FarmBot_42',    balance: 150,  defenseLevel: 1, droneCount: 1, droneType: 1,
    turrets: [{ level: 1 }, { level: 1 }] },

  { id: 'p2',  name: 'CryptoFarmer',  balance: 380,  defenseLevel: 2, droneCount: 2, droneType: 2,
    turrets: [{ level: 2 }, { level: 2 }, { level: 1 }, { level: 1 }] },

  { id: 'p3',  name: 'TonKing99',     balance: 720,  defenseLevel: 3, droneCount: 3, droneType: 3,
    turrets: [{ level: 3 }, { level: 3 }, { level: 2 }, { level: 1 }] },

  { id: 'p4',  name: 'DroneHunter_X', balance: 215,  defenseLevel: 1, droneCount: 2, droneType: 2,
    turrets: [{ level: 1 }, { level: 1 }, { level: 1 }] },

  { id: 'p5',  name: 'CyberNomad_7',  balance: 510,  defenseLevel: 2, droneCount: 3, droneType: 1,
    turrets: [{ level: 2 }, { level: 2 }, { level: 1 }, { level: 1 }] },

  { id: 'p6',  name: 'NanoRaider',    balance: 890,  defenseLevel: 3, droneCount: 4, droneType: 3,
    turrets: [{ level: 3 }, { level: 3 }, { level: 2 }, { level: 2 }, { level: 1 }] },

  { id: 'p7',  name: 'SkyPirate',     balance: 95,   defenseLevel: 1, droneCount: 1, droneType: 1,
    turrets: [{ level: 1 }] },

  { id: 'p8',  name: 'QuantumFarm',   balance: 1250, defenseLevel: 3, droneCount: 5, droneType: 2,
    turrets: [{ level: 3 }, { level: 3 }, { level: 3 }, { level: 2 }, { level: 2 }, { level: 1 }] },

  { id: 'p9',  name: 'SteelWing_01',  balance: 340,  defenseLevel: 2, droneCount: 2, droneType: 3,
    turrets: [{ level: 2 }, { level: 1 }, { level: 1 }] },

  { id: 'p10', name: 'GhostDrone',    balance: 680,  defenseLevel: 2, droneCount: 3, droneType: 2,
    turrets: [{ level: 2 }, { level: 2 }, { level: 1 }, { level: 1 }] },

  { id: 'p11', name: 'MegaFarmer',    balance: 2100, defenseLevel: 3, droneCount: 6, droneType: 3,
    turrets: [{ level: 3 }, { level: 3 }, { level: 3 }, { level: 2 }, { level: 2 }, { level: 1 }, { level: 1 }] },

  { id: 'p12', name: 'Alpha_Unit_9',  balance: 170,  defenseLevel: 1, droneCount: 1, droneType: 1,
    turrets: [{ level: 1 }, { level: 1 }] },

  { id: 'p13', name: 'IronSky_Pro',   balance: 430,  defenseLevel: 2, droneCount: 2, droneType: 2,
    turrets: [{ level: 2 }, { level: 2 }, { level: 1 }] },

  { id: 'p14', name: 'ZeroGravity',   balance: 960,  defenseLevel: 3, droneCount: 4, droneType: 3,
    turrets: [{ level: 3 }, { level: 3 }, { level: 2 }, { level: 2 }] },

  { id: 'p15', name: 'DarkFarmer',    balance: 280,  defenseLevel: 1, droneCount: 2, droneType: 1,
    turrets: [{ level: 1 }, { level: 1 }, { level: 1 }] },
]
