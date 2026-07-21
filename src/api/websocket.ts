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
      // AdSgram reward credited — refresh balance so the +50 gold shows up
      if (msg.payload?.type === 'adsgram_reward') {
        store.loadGameState()
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
      } else if (msg.payload?.type === 'listing_cancelled') {
        const id = Number(msg.payload.listing_id)
        if (id) store.markListingCancelled(id)
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
      // Duel force-expired by the cleanup worker: either the opponent never
      // showed up (ghost duel) or one side submitted their verdict and the
      // other never confirmed (verdict_timeout). Escrow was refunded to both
      // players — surface a toast with the refund amount and refresh balances
      // so the returned bet is visible immediately.
      const canvas = document.querySelector('[data-duel]')
      if (canvas) {
        // If battle scene is active, force-end it as a draw so the "победа/
        // поражение" overlay doesn't stick.
        canvas.dispatchEvent(new CustomEvent('duel-force-end', { detail: { won: false, disputed: true } }))
      }
      store.clearDuel()
      store.setPendingDuelChallenge(null)
      store.setDuelVerdictToast({
        kind:     'abandoned',
        duelId:   Number(msg.payload.duel_id ?? 0),
        refund:   Number(msg.payload.refund ?? 0),
        currency: String(msg.payload.currency ?? 'gold'),
        reason:   String(msg.payload.reason ?? 'timeout'),
      })
      store.loadGameState()
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

    case 'duel.start_state': {
      // Server-authoritative initial state: both players, stats, MaxHP.
      // Emitted once at the very start of a session.
      //
      // Race: start_state can arrive BEFORE the duel screen has mounted
      // (challenger transitions to it after seeing duel.start). Buffer the
      // last payload on `window` so DuelBattleScreen can drain it on mount.
      ;(window as any).__lastDuelStartState = msg.payload
      const canvas = document.querySelector('[data-duel]')
      canvas?.dispatchEvent(new CustomEvent('duel-start-state', { detail: msg.payload }))
      break
    }

    case 'duel.state': {
      // 20Hz tick from server: authoritative positions + HP.
      const canvas = document.querySelector('[data-duel]')
      canvas?.dispatchEvent(new CustomEvent('duel-state', { detail: msg.payload }))
      break
    }

    case 'duel.shot_fired': {
      // Server spawned a projectile — client only renders, doesn't simulate.
      const canvas = document.querySelector('[data-duel]')
      canvas?.dispatchEvent(new CustomEvent('duel-shot-fired', { detail: msg.payload }))
      break
    }

    case 'duel.hit': {
      // Bullet connected on the server — show sparks + shake if we're the target.
      const canvas = document.querySelector('[data-duel]')
      canvas?.dispatchEvent(new CustomEvent('duel-hit', { detail: msg.payload }))
      break
    }

    case 'duel.dodge': {
      const canvas = document.querySelector('[data-duel]')
      canvas?.dispatchEvent(new CustomEvent('duel-dodge', { detail: msg.payload }))
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

    case 'user.energy': {
      // Battery credited (or any other server-side energy top-up) — reflect it
      // immediately without waiting for the next /user/me. `reason` disambiguates
      // future top-ups (admin grant, event reward, ...).
      const energy    = Number(msg.payload.energy ?? 0)
      const maxEnergy = Number(msg.payload.max_energy ?? store.maxEnergy)
      useGameStore.setState({ energy, maxEnergy })
      store.refreshBatteryStatus()
      if (msg.payload?.reason === 'battery') {
        store.closeBatteryModal()
      }
      break
    }

    case 'shield.updated': {
      // Shield was extended after a successful Stars purchase — refresh user
      // (v_ip_until lives on the user object) and bump shieldVersion so the
      // ShieldModal re-reads /shield/price.
      // For Rescue Bundle: flip hasRescuePack optimistically so the upsell
      // card disappears the instant the event arrives, without waiting for
      // /user/me to complete.
      if (msg.payload?.reason === 'rescue_bundle') {
        useGameStore.setState({ hasRescuePack: true })
      }
      store.loadGameState()
      store.bumpShieldVersion()
      break
    }

    case 'referral.earned': {
      // Referrer earned from downline activity — either TON (purchase_pct)
      // or gold (progress). Payload carries `currency` so we render the
      // right unit; `amount` is unified (falls back to legacy amount_ton).
      const currency = msg.payload.currency === 'gold' ? 'gold' : 'ton'
      const amount   = Number(msg.payload.amount ?? msg.payload.amount_ton ?? 0)
      store.setReferralEarnedToast({
        amount,
        name:    String(msg.payload.referred_name ?? '?'),
        total:   Number(msg.payload.total_earned ?? 0),
        level:   Number(msg.payload.level ?? 1),
        trigger: String(msg.payload.trigger ?? ''),
        currency,
      })
      // Refresh balance/ton_balance so the +amount is visible immediately
      store.loadGameState()
      break
    }

    case 'duel.result': {
      // Battle ended (other player submitted result) — force-end this client's scene
      const myId = useGameStore.getState().userId
      const won  = Number(msg.payload.winner_id) === myId
      const canvas3 = document.querySelector('[data-duel]')
      if (canvas3) {
        canvas3.dispatchEvent(new CustomEvent('duel-force-end', { detail: { won } }))
      } else {
        // Scene not mounted yet — navigate result directly via store
        // (edge case: result arrived before battle screen mounted)
        store.endDuel(won)
      }
      break
    }

    // NOTE: duel.await_verdict / duel.disputed retired with the client-verdict
    // model. The server now decides winner from the physics tick; only
    // duel.result and duel.abandoned survive as terminal events.
    //
    // 'duel.abandoned' is handled higher up (near 'duel.cancelled') so
    // the pre-existing clearDuel + activeScreen reset stays in one place.
  }
}
