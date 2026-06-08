import { getAuthToken } from './client'
import { useGameStore, type IncomingRaidEntry } from '../store/gameStore'

const WS_BASE = import.meta.env.VITE_WS_URL
  ?? (import.meta.env.VITE_API_URL ?? 'http://localhost:8080').replace(/^http/, 'ws')

type WsMessage = { type: string; payload: Record<string, unknown> }

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectDelay = 2_000
let stopped = false

export function connectWebSocket(): void {
  stopped = false
  open()
}

export function disconnectWebSocket(): void {
  stopped = true
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  ws?.close()
  ws = null
}

function open() {
  if (stopped) return
  if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return

  getAuthToken()
    .then((token) => {
      if (stopped) return
      ws = new WebSocket(`${WS_BASE}/ws?token=${token}`)

      ws.onopen = () => {
        reconnectDelay = 2_000
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as WsMessage
          dispatch(msg)
        } catch { /* ignore malformed frame */ }
      }

      ws.onerror = () => { ws?.close() }

      ws.onclose = () => {
        ws = null
        if (!stopped) scheduleReconnect()
      }
    })
    .catch(() => { if (!stopped) scheduleReconnect() })
}

function scheduleReconnect() {
  if (reconnectTimer || stopped) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    reconnectDelay = Math.min(reconnectDelay * 2, 30_000)
    open()
  }, reconnectDelay)
}

function dispatch(msg: WsMessage) {
  const store = useGameStore.getState()

  switch (msg.type) {
    case 'farm.push': {
      // Sub-type dispatch: raid_incoming arrives on this channel
      if (msg.payload?.type === 'raid_incoming') {
        const defended = msg.payload.result !== 'victory'
        const entry: IncomingRaidEntry = {
          id:           String(msg.payload.raid_id ?? Date.now()),
          attackerName: String(msg.payload.attacker_name ?? `#${msg.payload.attacker_id}`),
          attackerId:   Number(msg.payload.attacker_id ?? 0),
          won:          defended,
          // On victory: how much was stolen. On defense: how much was saved (coins_attempted).
          amount:       defended
            ? Number(msg.payload.coins_attempted ?? 0)
            : Number(msg.payload.coins_stolen ?? 0),
          timestamp:    Date.now(),
        }
        store.addIncomingRaid(entry)
        // Refresh balance since coins may have been stolen
        store.loadGameState()
      }
      break
    }
    case 'raid.update':
      // Attacker's raid confirmed — refresh drones health
      store.loadGameState()
      break
    case 'market.bid':
      // another user bought/listed — no immediate UI action needed
      break
  }
}
