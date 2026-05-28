export interface MockPlayer {
  id: string
  name: string
  balance: number
  defenseLevel: 1 | 2 | 3
  droneCount: number
}

export const MOCK_PLAYERS: MockPlayer[] = [
  { id: 'p1', name: 'FarmBot_42',    balance: 150, defenseLevel: 1, droneCount: 1 },
  { id: 'p2', name: 'CryptoFarmer',  balance: 380, defenseLevel: 2, droneCount: 2 },
  { id: 'p3', name: 'TonKing99',     balance: 720, defenseLevel: 3, droneCount: 3 },
]
