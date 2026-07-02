import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from './store/gameStore'
import { connectWebSocket, disconnectWebSocket } from './api/websocket'
import { BottomNav } from './components/BottomNav'
import { RaidAlert } from './components/RaidAlert'
import { RaidDefendPrompt } from './components/RaidDefendPrompt'
import { ShieldModal } from './components/ShieldModal'
import { TonDepositToast } from './components/TonDepositToast'
import { MarketSoldToast } from './components/MarketSoldToast'
import { ReferralEarnedToast } from './components/ReferralEarnedToast'
import { DailyBonusModal } from './components/DailyBonusModal'
import { NotificationPermissionToast } from './components/NotificationPermissionToast'
import { CaptchaModal } from './components/CaptchaModal'
import { Confetti } from './components/Confetti'
import { FarmScreen } from './screens/FarmScreen'
import { ShopScreen } from './screens/ShopScreen'
import { RaidsScreen } from './screens/RaidsScreen'
import { EquipmentScreen } from './screens/EquipmentScreen'
import { UnitDetailScreen } from './screens/UnitDetailScreen'
import { MarketScreen } from './screens/MarketScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { PurchaseHistoryScreen } from './screens/PurchaseHistoryScreen'
import { TopUpScreen } from './screens/TopUpScreen'
import { MarketHistoryScreen } from './screens/MarketHistoryScreen'
import { ContestScreen } from './screens/ContestScreen'
import { DuelScreen } from './screens/DuelScreen'
import { DuelBattleScreen } from './screens/DuelBattleScreen'
import { DuelHistoryScreen } from './screens/DuelHistoryScreen'
import { ReferralsScreen } from './screens/ReferralsScreen'
import { FavoritesScreen } from './screens/FavoritesScreen'
import { WithdrawalScreen } from './screens/WithdrawalScreen'
import { FAQScreen } from './screens/FAQScreen'
import { TasksScreen } from './screens/TasksScreen'
import { DuelChallengeModal } from './components/DuelChallengeModal'
import { DuelWaitingModal } from './components/DuelWaitingModal'
import { NAV_HEIGHT } from './layout'

export function App() {
  const { t, i18n } = useTranslation()
  const screen        = useGameStore((s) => s.activeScreen)
  const isLoaded      = useGameStore((s) => s.isLoaded)
  const loadError     = useGameStore((s) => s.loadError)
  const showConfetti  = useGameStore((s) => s.showConfetti)
  const hideConfetti  = useGameStore((s) => s.hideConfetti)
  const loadGameState = useGameStore((s) => s.loadGameState)
  const language      = useGameStore((s) => s.language)
  const shieldModalOpen  = useGameStore((s) => s.shieldModalOpen)
  const closeShieldModal = useGameStore((s) => s.closeShieldModal)

  useEffect(() => { loadGameState() }, [loadGameState])

  // Deep-link from Telegram inline buttons / share URL: ?startapp=screen_<name>
  // Whitelisted to a fixed set of Screen values to avoid arbitrary state injection.
  useEffect(() => {
    if (!isLoaded) return
    const param = new URLSearchParams(window.location.search).get('startapp')
                ?? (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param
                ?? ''
    if (!param.startsWith('screen_')) return
    const target = param.slice('screen_'.length)
    const allowed: ReadonlyArray<string> = [
      'raids', 'duel', 'market', 'shop', 'profile', 'contest',
      'referrals', 'favorites', 'topup', 'equipment',
    ]
    if (allowed.includes(target)) {
      useGameStore.getState().setScreen(target as any)
    }
  }, [isLoaded])

  useEffect(() => {
    if (isLoaded && !loadError) {
      connectWebSocket()
      return disconnectWebSocket
    }
  }, [isLoaded, loadError])

  // Sync i18next language with the value loaded from the API
  useEffect(() => {
    if (language && i18n.language !== language) {
      i18n.changeLanguage(language)
    }
  }, [language, i18n])

  useEffect(() => {
    const id = setInterval(() => {
      const s = useGameStore.getState()
      s.tickEnergyRegen()
      s.tickBalance()
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Flush accumulated tap bonus to backend every 3 seconds
  useEffect(() => {
    const id = setInterval(() => {
      useGameStore.getState().flushTaps()
    }, 3000)
    return () => clearInterval(id)
  }, [])

  // Also flush immediately when tab is hidden (user switches away or closes).
  // Energy is server-authoritative — no client-side sync needed.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        useGameStore.getState().flushTaps()
      }
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  if (!isLoaded) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: '#0d1117', color: '#06b6d4', fontSize: 18,
      }}>
        {t('app.loading')}
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#0d1117', color: '#f87171', gap: 12, padding: 24,
      }}>
        <span>{t('app.error')}</span>
        <span style={{ fontSize: 13, opacity: 0.6 }}>{loadError}</span>
        <button
          style={{ marginTop: 8, padding: '8px 20px', background: '#06b6d4', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          onClick={loadGameState}
        >
          {t('app.retry')}
        </button>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0d1117' }}>
      <RaidAlert />
      <RaidDefendPrompt />
      <ShieldModal open={shieldModalOpen} onClose={closeShieldModal} />
      <TonDepositToast />
      <MarketSoldToast />
      <ReferralEarnedToast />
      <DailyBonusModal />
      <NotificationPermissionToast />
      <CaptchaModal />
      {showConfetti && <Confetti onDone={hideConfetti} />}
      <DuelChallengeModal />
      <DuelWaitingModal />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: NAV_HEIGHT, overflow: 'hidden' }}>
        {screen === 'farm'        && <FarmScreen />}
        {screen === 'shop'        && <ShopScreen />}
        {screen === 'raids'       && <RaidsScreen />}
        {screen === 'market'         && <MarketScreen />}
        {screen === 'market-history' && <MarketHistoryScreen />}
        {screen === 'contest'        && <ContestScreen />}
        {screen === 'equipment'   && <EquipmentScreen />}
        {screen === 'unit-detail' && <UnitDetailScreen />}
        {screen === 'profile'     && <ProfileScreen />}
        {screen === 'purchases'   && <PurchaseHistoryScreen />}
        {screen === 'topup'       && <TopUpScreen />}
        {screen === 'withdrawal'  && <WithdrawalScreen />}
        {screen === 'duel'         && <DuelScreen />}
        {screen === 'duel-battle'  && <DuelBattleScreen />}
        {screen === 'duel-history' && <DuelHistoryScreen />}
        {screen === 'referrals'    && <ReferralsScreen />}
        {screen === 'favorites'    && <FavoritesScreen />}
        {screen === 'faq'          && <FAQScreen />}
        {screen === 'tasks'        && <TasksScreen />}
      </div>
      <BottomNav />
    </div>
  )
}
