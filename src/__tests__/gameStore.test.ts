import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useGameStore, mapDrone, mapTurret } from '../store/gameStore'
import type { ApiDrone, ApiTurret } from '../api/types'

// ── Helpers ────────────────────────────────────────────────────────────────

function resetStore() {
  useGameStore.setState({
    balance:        0,
    energy:         100,
    maxEnergy:      100,
    energyProgress: 0,
    drones:         [],
    turrets:        [],
    isLoaded:       false,
    loadError:      null,
    raidLog:        [],
    lastRaidResult: null,
    unitUpgrades:   {},
  })
}

const mockApiDrone: ApiDrone = {
  id: 1, user_id: 1, drone_type: 'scout', level: 1, health: 100,
  is_broken: false, position_x: 0, position_y: 0, income_rate: 0.001,
  upgrades: [],
}

const mockApiTurret: ApiTurret = {
  id: 1, user_id: 1, turret_level: 1, level: 1, position_x: 0, position_y: 0,
  defense_power: 10, upgrades: [],
}

// ── mapDrone ───────────────────────────────────────────────────────────────

describe('mapDrone', () => {
  it('maps scout type to droneType 1', () => {
    const d = mapDrone(mockApiDrone)
    expect(d.droneType).toBe(1)
    expect(d.id).toBe('1')
    expect(d.level).toBe(1)
    expect(d.incomePerSec).toBe(0.001)
    expect(d.isBroken).toBe(false)
  })

  it('maps combat type to droneType 2', () => {
    expect(mapDrone({ ...mockApiDrone, drone_type: 'combat' }).droneType).toBe(2)
  })

  it('maps stealth type to droneType 3', () => {
    expect(mapDrone({ ...mockApiDrone, drone_type: 'stealth' }).droneType).toBe(3)
  })

  it('falls back to droneType 1 for unknown type', () => {
    expect(mapDrone({ ...mockApiDrone, drone_type: 'unknown' as any }).droneType).toBe(1)
  })

  it('preserves is_broken flag', () => {
    expect(mapDrone({ ...mockApiDrone, is_broken: true }).isBroken).toBe(true)
  })
})

// ── mapTurret ──────────────────────────────────────────────────────────────

describe('mapTurret', () => {
  it('maps ApiTurret to local Turret', () => {
    const t = mapTurret(mockApiTurret)
    expect(t.id).toBe('1')
    expect(t.level).toBe(1)
  })

  it('maps level from turret.level field', () => {
    expect(mapTurret({ ...mockApiTurret, level: 3 }).level).toBe(3)
  })
})

// ── store state ────────────────────────────────────────────────────────────

describe('gameStore initial state', () => {
  beforeEach(resetStore)

  it('starts with empty drones and turrets', () => {
    const { drones, turrets } = useGameStore.getState()
    expect(drones).toHaveLength(0)
    expect(turrets).toHaveLength(0)
  })

  it('starts not loaded', () => {
    expect(useGameStore.getState().isLoaded).toBe(false)
  })

  it('starts with balance 0', () => {
    expect(useGameStore.getState().balance).toBe(0)
  })
})

// ── addBalance ─────────────────────────────────────────────────────────────

describe('addBalance', () => {
  beforeEach(resetStore)

  it('increments balance', () => {
    useGameStore.getState().addBalance(150)
    expect(useGameStore.getState().balance).toBe(150)
  })

  it('handles fractional amounts', () => {
    useGameStore.getState().addBalance(0.0036)
    expect(useGameStore.getState().balance).toBeCloseTo(0.0036)
  })
})

// ── tickEnergyRegen ────────────────────────────────────────────────────────

describe('tickEnergyRegen', () => {
  beforeEach(resetStore)

  it('does nothing when energy is full', () => {
    useGameStore.setState({ energy: 100, maxEnergy: 100 })
    useGameStore.getState().tickEnergyRegen()
    expect(useGameStore.getState().energy).toBe(100)
  })

  it('accumulates progress when energy < max', () => {
    useGameStore.setState({ energy: 50, maxEnergy: 100 })
    useGameStore.getState().tickEnergyRegen()
    expect(useGameStore.getState().energyProgress).toBeGreaterThan(0)
  })
})

// ── UI actions ─────────────────────────────────────────────────────────────

describe('UI actions', () => {
  beforeEach(resetStore)

  it('setScreen changes active screen', () => {
    useGameStore.getState().setScreen('shop')
    expect(useGameStore.getState().activeScreen).toBe('shop')
  })

  it('toggleSound toggles soundEnabled', () => {
    const before = useGameStore.getState().soundEnabled
    useGameStore.getState().toggleSound()
    expect(useGameStore.getState().soundEnabled).toBe(!before)
  })

  it('selectUnit sets selectedUnitId', () => {
    useGameStore.getState().selectUnit('drone-1')
    expect(useGameStore.getState().selectedUnitId).toBe('drone-1')
    useGameStore.getState().selectUnit(null)
    expect(useGameStore.getState().selectedUnitId).toBeNull()
  })

  it('clearRaidResult clears lastRaidResult', () => {
    useGameStore.setState({ lastRaidResult: { won: true, amount: 50, targetName: 'X' } })
    useGameStore.getState().clearRaidResult()
    expect(useGameStore.getState().lastRaidResult).toBeNull()
  })
})

// ── purchaseUnitUpgrade ────────────────────────────────────────────────────

describe('purchaseUnitUpgrade', () => {
  beforeEach(() => {
    resetStore()
    useGameStore.setState({ balance: 500 })
  })

  it('deducts cost and increments upgrade level', () => {
    const ok = useGameStore.getState().purchaseUnitUpgrade('drone-1', 'armor', 100)
    expect(ok).toBe(true)
    expect(useGameStore.getState().balance).toBe(400)
    expect(useGameStore.getState().unitUpgrades['drone-1']?.['armor']).toBe(1)
  })

  it('rejects when balance is insufficient', () => {
    const ok = useGameStore.getState().purchaseUnitUpgrade('drone-1', 'armor', 1000)
    expect(ok).toBe(false)
    expect(useGameStore.getState().balance).toBe(500)
  })

  it('caps upgrade at level 3', () => {
    useGameStore.setState({ unitUpgrades: { 'drone-1': { 'armor': 3 } } })
    const ok = useGameStore.getState().purchaseUnitUpgrade('drone-1', 'armor', 100)
    expect(ok).toBe(false)
  })
})

// ── loadGameState ──────────────────────────────────────────────────────────

describe('loadGameState', () => {
  beforeEach(resetStore)

  it('sets isLoaded=true and populates state on success', async () => {
    vi.doMock('../api', () => ({
      getMe:      vi.fn().mockResolvedValue({ balance: '1000.5', energy: 80, max_energy: 100 }),
      getDrones:  vi.fn().mockResolvedValue([mockApiDrone]),
      getTurrets: vi.fn().mockResolvedValue([mockApiTurret]),
    }))

    // Re-import store to get mocked API version
    const { useGameStore: store } = await import('../store/gameStore')
    await store.getState().loadGameState()

    expect(store.getState().isLoaded).toBe(true)
  })

  it('sets loadError on failure', async () => {
    vi.doMock('../api', () => ({
      getMe:      vi.fn().mockRejectedValue(new Error('network error')),
      getDrones:  vi.fn().mockResolvedValue([]),
      getTurrets: vi.fn().mockResolvedValue([]),
    }))

    const { useGameStore: store } = await import('../store/gameStore')
    await store.getState().loadGameState()

    expect(store.getState().loadError).toBeTruthy()
    expect(store.getState().isLoaded).toBe(true)
  })
})
