import { getAuthToken } from './client'
import { useGameStore, type IncomingRaidEntry } from '../store/gameStore'
import type { ApiDuelChallenge } from './types'

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

export function sendWsEvent(type: string, payload: Record<string, unknown>): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload }))
  }
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
      // TON deposit credited — update ton_balance immediately
      if (msg.payload?.type === 'ton.deposit') {
        const newBal = Number(msg.payload.ton_balance ?? 0)
        const amount = Number(msg.payload.amount ?? 0)
        store.setTonBalance(newBal)
        store.setTonDepositToast({ amount })
        break
      }
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
      if (msg.payload?.type === 'listing_sold') {
        // Our listing was bought — refresh state and show toast
        store.loadGameState()
        store.setMarketSoldToast({
          price:     Number(msg.payload.price ?? 0),
          payout:    msg.payload.payout != null ? Number(msg.payload.payout) : undefined,
          currency:  String(msg.payload.currency ?? 'gold'),
          unitType:  String(msg.payload.unit_type ?? ''),
          buyerName: msg.payload.buyer_name ? String(msg.payload.buyer_name) : undefined,
        })
      } else if (msg.payload?.type === 'unit_received') {
        // We just bought a unit — refresh equipment + confetti
        store.loadGameState()
        store.triggerConfetti()
      }
      break

    case 'duel.challenge': {
      const challenge: ApiDuelChallenge = {
        duel_id:          Number(msg.payload.duel_id ?? 0),
        challenger_id:    Number(msg.payload.challenger_id ?? 0),
        challenger_name:  String(msg.payload.challenger_name ?? '?'),
        challenger_power: Number(msg.payload.challenger_power ?? 0),
        bet_amount:       Number(msg.payload.bet_amount ?? 0),
        currency:         (msg.payload.currency as 'gold' | 'ton') ?? 'gold',
        expires_at:       Number(msg.payload.expires_at ?? 0),
      }
      store.setPendingDuelChallenge(challenge)
      break
    }

    case 'duel.start':
      // Defender accepted — challenger activates pending duel config
      store.activatePendingDuel()
      break

    case 'duel.cancelled':
      // Challenger cancelled — close the incoming challenge modal on defender's side
      store.setPendingDuelChallenge(null)
      break

    case 'duel.abandoned': {
      // Duel timed out (player closed browser) — clear all duel state
      const canvas = document.querySelector('canvas[data-duel]')
      if (canvas) {
        // If battle scene is active, force-end it as a draw/loss
        canvas.dispatchEvent(new CustomEvent('duel-force-end', { detail: { won: false } }))
      }
      store.clearDuel()
      store.setPendingDuelChallenge(null)
      useGameStore.setState({
        activeScreen: 'duel',
        duelDeclined: false,
      })
      break
    }

    case 'duel.declined':
      // Defender declined — show "declined" notification to challenger
      store.clearDuel()
      store.setPendingDuelChallenge(null)
      useGameStore.setState({ duelDeclined: true })
      break

    case 'duel.move': {
      // Normalised position (0–1) — DuelScene denormalises to local pixels
      const canvas = document.querySelector('canvas[data-duel]')
      canvas?.dispatchEvent(new CustomEvent('duel-opponent-move', {
        detail: { nx: Number(msg.payload.nx), ny: Number(msg.payload.ny) },
      }))
      break
    }

    case 'duel.shoot': {
      const canvas2 = document.querySelector('canvas[data-duel]')
      canvas2?.dispatchEvent(new CustomEvent('duel-opponent-shoot', {
        detail: { ntx: Number(msg.payload.ntx), nty: Number(msg.payload.nty) },
      }))
      break
    }

    case 'duel.hp_sync': {
      // Opponent's actual HP (they were hit, broadcasting their current HP)
      const canvas4 = document.querySelector('canvas[data-duel]')
      canvas4?.dispatchEvent(new CustomEvent('duel-opponent-hp-sync', {
        detail: { hp: Number(msg.payload.hp) },
      }))
      break
    }

    case 'player.online': {
      const uid = Number(msg.payload.user_id)
      if (uid) useGameStore.setState((s) => ({ onlineStatus: { ...s.onlineStatus, [uid]: true } }))
      break
    }
    case 'player.offline': {
      const uid = Number(msg.payload.user_id)
      if (uid) useGameStore.setState((s) => ({ onlineStatus: { ...s.onlineStatus, [uid]: false } }))
      break
    }

    case 'duel.result': {
      // Battle ended (other player submitted result) — force-end this client's scene
      const myId = useGameStore.getState().userId
      const won  = Number(msg.payload.winner_id) === myId
      const canvas3 = document.querySelector('canvas[data-duel]')
      if (canvas3) {
        canvas3.dispatchEvent(new CustomEvent('duel-force-end', { detail: { won } }))
      } else {
        // Scene not mounted yet — navigate result directly via store
        // (edge case: result arrived before battle screen mounted)
        store.endDuel(won)
      }
      break
    }
  }
}
