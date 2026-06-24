import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useTonWallet, useTonConnectUI } from '@tonconnect/ui-react'
import { useGameStore } from '../store/gameStore'
import { fmtGold } from '../utils/format'
import { getWalletInvoice, connectWallet, disconnectWallet, getRaidHistory, prepareReferralMessage, getReferralStats } from '../api'
import type { ApiWalletInvoice, ApiRaid, ReferralStats } from '../api/types'
import styles from './ProfileScreen.module.css'

function calcStreak(raids: ApiRaid[]): number {
  // API returns newest first; count consecutive victories from the top
  let s = 0
  for (const r of raids) {
    if (r.result === 'victory') s++
    else break
  }
  return s
}

function getInitials(firstName: string, lastName: string): string {
  const f = firstName.trim()
  const l = lastName.trim()
  if (f && l) return (f[0] + l[0]).toUpperCase()
  if (f.length >= 2) return f.slice(0, 2).toUpperCase()
  return f.toUpperCase() || '?'
}

function getTgPhotoUrl(): string | null {
  try {
    return (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.photo_url ?? null
  } catch {
    return null
  }
}

const RING_R = 44
const RING_CIRC = 2 * Math.PI * RING_R // ≈ 276.46

function WinRateRing({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses
  const rate = total > 0 ? wins / total : 0
  const dashoffset = RING_CIRC * (1 - rate)
  const pct = Math.round(rate * 100)

  return (
    <div className={styles.ringWrap}>
      <svg width="104" height="104" viewBox="0 0 104 104">
        <defs>
          <linearGradient id="ringG" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#28e0ff" />
            <stop offset="1" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <circle cx="52" cy="52" r={RING_R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" />
        <circle
          cx="52" cy="52" r={RING_R}
          fill="none"
          stroke="url(#ringG)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={RING_CIRC}
          strokeDashoffset={dashoffset}
          style={{ filter: 'drop-shadow(0 0 6px rgba(40,224,255,0.5))' }}
        />
      </svg>
      <div className={styles.ringCenter}>
        <span className={styles.ringPct}>{pct}%</span>
        <span className={styles.ringLbl}>Win rate</span>
      </div>
    </div>
  )
}

export function ProfileScreen() {
  const balance      = useGameStore((s) => s.balance)
  const tonBalance   = useGameStore((s) => s.tonBalance)
  const tonWallet    = useGameStore((s) => s.tonWallet)
  const setTonWallet = useGameStore((s) => s.setTonWallet)
  const setScreen    = useGameStore((s) => s.setScreen)
  const raidLog      = useGameStore((s) => s.raidLog)
  const soundEnabled = useGameStore((s) => s.soundEnabled)
  const toggleSound      = useGameStore((s) => s.toggleSound)
  const language            = useGameStore((s) => s.language)
  const updateLanguage      = useGameStore((s) => s.updateLanguage)
  const allowNotification   = useGameStore((s) => s.allowNotification)
  const updateNotifications = useGameStore((s) => s.updateNotifications)
  const allowDuel           = useGameStore((s) => s.allowDuel)
  const updateDuelSettings  = useGameStore((s) => s.updateDuelSettings)
  const drones              = useGameStore((s) => s.drones)
  const turrets          = useGameStore((s) => s.turrets)
  const incomeRateTotal  = useGameStore((s) => s.incomeRateTotal)
  const firstName        = useGameStore((s) => s.firstName)
  const lastName         = useGameStore((s) => s.lastName)
  const username         = useGameStore((s) => s.username)
  const telegramId       = useGameStore((s) => s.telegramId)
  const { t, i18n }     = useTranslation()
  const settingsRef     = useRef<HTMLDivElement>(null)

  // Full raid history for stats
  const [allRaids,    setAllRaids]    = useState<ApiRaid[]>([])
  const [statsLoaded, setStatsLoaded] = useState(false)

  // Referral stats
  const [refStats, setRefStats] = useState<ReferralStats | null>(null)

  useEffect(() => {
    getRaidHistory()
      .then(raids => { setAllRaids(raids); setStatsLoaded(true) })
      .catch(()  => setStatsLoaded(true))
    getReferralStats()
      .then(setRefStats)
      .catch(() => {})
  }, [])

  const displayName = [firstName, lastName].filter(Boolean).join(' ') || username || `#${telegramId}`
  const initials    = getInitials(firstName, lastName)
  const photoUrl    = getTgPhotoUrl()

  // TON Connect
  const tcWallet         = useTonWallet()
  const [tonConnectUI]   = useTonConnectUI()

  // Sync TON Connect wallet address → API whenever it changes
  useEffect(() => {
    const address = tcWallet?.account?.address ?? ''
    if (address && address !== tonWallet) {
      connectWallet(address)
        .then(() => setTonWallet(address))
        .catch(() => {/* silent — user can retry */})
    }
    if (!address && tonWallet) {
      // Wallet disconnected on the TON Connect side
      disconnectWallet()
        .then(() => setTonWallet(''))
        .catch(() => {})
    }
  }, [tcWallet?.account?.address]) // eslint-disable-line react-hooks/exhaustive-deps

  const [tonModal,   setTonModal]   = useState(false)
  const [invoice,    setInvoice]    = useState<ApiWalletInvoice | null>(null)
  const [invoiceErr, setInvoiceErr] = useState(false)
  const [copied,     setCopied]     = useState<'wallet' | 'comment' | null>(null)

  const walletConnected = !!tcWallet?.account?.address
  const walletAddress   = tcWallet?.account?.address ?? tonWallet

  // Referral link
  const botUrl   = import.meta.env.VITE_BOT_URL ?? ''
  const refLink  = botUrl
    ? `${botUrl}?start=ref_${telegramId}`
    : ''
  const [refCopied,  setRefCopied]  = useState(false)
  const [shareState, setShareState] = useState<'idle' | 'loading' | 'error'>('idle')

  const tgWebApp = (window as any).Telegram?.WebApp

  // Universal share fallback: opens Telegram chat picker via t.me/share
  const shareViaLink = () => {
    if (!refLink) { copyRefLink(); return }
    const text = t('profile.inviteDesc')
    if (tgWebApp?.openTelegramLink) {
      tgWebApp.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(text)}`
      )
    } else {
      copyRefLink()
    }
  }

  const handleShare = async () => {
    if (!refLink) return
    setShareState('loading')
    try {
      const prepared = await prepareReferralMessage()
      const tg = (window as any).Telegram?.WebApp
      if (tg?.sendPreparedMessage) {
        tg.sendPreparedMessage({ id: prepared.id })
      } else {
        // fallback: raw postEvent via TelegramWebviewProxy
        ;(window as any).TelegramWebviewProxy?.postEvent(
          'web_app_send_prepared_message',
          JSON.stringify({ id: prepared.id }),
        )
      }
      setShareState('idle')
    } catch {
      setShareState('idle')
      shareViaLink()
    }
  }

  const copyRefLink = () => {
    if (!refLink) return
    navigator.clipboard.writeText(refLink).then(() => {
      setRefCopied(true)
      setTimeout(() => setRefCopied(false), 1500)
    })
  }

  const openTonModal = async () => {
    setTonModal(true)
    setInvoiceErr(false)
    if (!invoice) {
      try {
        const data = await getWalletInvoice()
        setInvoice(data)
      } catch {
        setInvoiceErr(true)
      }
    }
  }

  const copyText = (text: string, key: 'wallet' | 'comment') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  // Battle stats from full history (falls back to session raidLog while loading)
  const wins   = statsLoaded ? allRaids.filter(r => r.result === 'victory').length
                             : raidLog.filter(r => r.won).length
  const losses = statsLoaded ? allRaids.filter(r => r.result === 'defeat').length
                             : raidLog.filter(r => !r.won).length
  const total  = wins + losses
  const streak = statsLoaded ? calcStreak(allRaids) : 0

  // Level: 1 level per 10 raids, starts at 1
  const level     = Math.max(1, Math.floor(total / 10) + 1)
  const xpInLevel = total % 10
  const xpToNext  = 10
  const xpPct     = (xpInLevel / xpToNext) * 100

  const winPct  = total > 0 ? Math.round((wins / total) * 100) : 0
  const lossPct = 100 - winPct

  // Farm stats
  const incomePerHour = Math.round(incomeRateTotal * 3600)
  const dronesActive  = drones.filter(d => !d.isBroken).length

  return (
    <div className={styles.screen}>
      {/* Top bar */}
      <div className={styles.topbar}>
        <span className={styles.topbarTitle}>{t('profile.title')}</span>
        <button className={styles.iconBtn} aria-label="Настройки" onClick={() => settingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.stack}>

          {/* ── Hero ── */}
          <section className={styles.card + ' ' + styles.hero}>
            <div className={styles.heroRow}>
              <div className={styles.avatarRing}>
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={displayName}
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div className={styles.avatarInner}>
                    <span className={styles.initials}>{initials}</span>
                  </div>
                )}
                <span className={styles.onlineDot} />
              </div>
              <div className={styles.heroId}>
                <div className={styles.nameRow}>
                  <span className={styles.name}>{displayName}</span>
                </div>
                {username ? <div className={styles.uname}>@{username}</div> : null}
                <div className={styles.tgId}>TG ID · {telegramId || '—'}</div>
                <div className={styles.lvlChip}>
                  <svg className={styles.lvlChipIcon} width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>
                  </svg>
                  {t('profile.levelN', {n: level})}
                </div>
              </div>
            </div>
            <div className={styles.xp}>
              <div className={styles.xpTop}>
                <span>{t('profile.expTo', {n: level + 1})}</span>
                <span><b>{xpInLevel}</b> / {xpToNext} {t('profile.raids').toLowerCase()}</span>
              </div>
              <div className={styles.xpTrack}>
                <div className={styles.xpFill} style={{ width: `${xpPct}%` }} />
              </div>
            </div>
          </section>

          {/* ── Balances ── */}
          <div className={styles.secLabel}><span className={styles.secDot} />{t('profile.section_bal')}</div>
          <div className={styles.balRow}>
            <div className={`${styles.card} ${styles.bal} ${styles.balGold}`}>
              <div className={styles.balIc}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#f6c544">
                  <circle cx="12" cy="12" r="9" opacity=".25"/>
                  <circle cx="12" cy="12" r="9" fill="none" stroke="#f6c544" strokeWidth="1.6"/>
                  <path d="M12 7l1.5 3.1 3.4.3-2.6 2.2.8 3.3L12 14.3 8.9 16.2l.8-3.3-2.6-2.2 3.4-.3L12 7z"/>
                </svg>
              </div>
              <div className={styles.balAmt}>{fmtGold(balance)}</div>
              <div className={styles.balSub}>{t('profile.gold')}</div>
            </div>
            <button
              className={`${styles.card} ${styles.bal} ${styles.balTon}`}
              onClick={openTonModal}
              style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid rgba(54,179,246,0.25)' }}
            >
              <div className={styles.balIc}>
                <svg width="22" height="22" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" fill="#36b3f6"/>
                  <path d="M7 8.6h10c.46 0 .73.5.5.9l-5 8.5a.58.58 0 0 1-1 0l-5-8.5a.58.58 0 0 1 .5-.9z" fill="#fff"/>
                  <path d="M12 9v8.4" stroke="#36b3f6" strokeWidth="1.1"/>
                </svg>
              </div>
              <div className={styles.balAmt}>{tonBalance.toFixed(4)}</div>
              <div className={styles.balSub}>TON <span style={{ fontSize: 10, color: '#36b3f6', marginLeft: 4 }}>+ {t('profile.topupTon')}</span></div>
            </button>
          </div>

          {/* ── Farm stats ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: t('profile.stat_drones'),  value: `${dronesActive}/${drones.length}`,     icon: '🛸' },
              { label: t('profile.stat_turrets'), value: String(turrets.length),                  icon: '🛡' },
              { label: t('profile.stat_income'),  value: `⬡${incomePerHour.toLocaleString('ru')}`, icon: '⚡' },
            ].map(({ label, value, icon }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.04)', borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.07)',
                padding: '10px 8px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0' }}>{value}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* ── Stars Top-up ── */}
          <button
            onClick={() => setScreen('topup')}
            style={{
              width: '100%', padding: '14px 18px', borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(91,33,182,0.25))',
              border: '1px solid rgba(124,58,237,0.4)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 26 }}>⭐</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#e0e0e0' }}>{t('topup.title')}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{t('topup.profileHint')}</div>
            </div>
            <span style={{ color: '#7c3aed', fontSize: 18 }}>→</span>
          </button>

          {/* ── Wallet CTA (withdrawal only) ── */}
          <section className={`${styles.card} ${styles.wallet}`} style={{ flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className={styles.walletIc}>
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10.5" fill={walletConnected ? '#22c55e' : '#36b3f6'}/>
                  <path d="M6.7 8.3h10.6c.5 0 .8.55.55.98l-5.3 9.05a.62.62 0 0 1-1.06 0L6.15 9.28a.62.62 0 0 1 .55-.98z" fill="#fff"/>
                  <path d="M12 8.8v9.2" stroke={walletConnected ? '#22c55e' : '#36b3f6'} strokeWidth="1.2"/>
                </svg>
              </div>
              <div className={styles.walletTxt} style={{ flex: 1 }}>
                <div className={styles.walletT1}>
                  <span className={styles.walletT1Name}>{t('profile.tonWallet')}</span>
                  <span className={styles.walletStat} style={{ color: walletConnected ? '#4ade80' : undefined }}>
                    {walletConnected ? t('profile.connected') : t('profile.notConnected')}
                  </span>
                </div>
                {!walletConnected && (
                  <div className={styles.walletT2}>{t('profile.walletWithdrawOnly')}</div>
                )}
              </div>
              {walletConnected ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
                  <button
                    className={styles.walletBtnSm}
                    style={{ background: 'rgba(2,132,199,0.15)', color: '#38bdf8', borderColor: 'rgba(2,132,199,0.3)' }}
                    onClick={() => setScreen('withdrawal')}
                  >
                    ↑ {t('profile.withdraw')}
                  </button>
                  <button
                    className={styles.walletBtnSm}
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', borderColor: 'rgba(239,68,68,0.25)' }}
                    onClick={() => tonConnectUI.disconnect()}
                  >
                    {t('profile.disconnectWallet')}
                  </button>
                </div>
              ) : (
                <button className={styles.walletBtn} onClick={() => tonConnectUI.openModal()}>
                  {t('profile.connectWallet')}
                </button>
              )}
            </div>
            {walletConnected && walletAddress && (
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b', paddingLeft: 2, wordBreak: 'break-all' }}>
                {walletAddress.slice(0, 10)}…{walletAddress.slice(-8)}
              </div>
            )}
          </section>

          {/* ── Battle stats ── */}
          <div className={styles.secLabel}><span className={styles.secDot} />{t('profile.section_stats')}</div>
          <section className={`${styles.card} ${styles.battle}`}>
            <div className={styles.battleHead}>
              <span className={styles.battleTitle}>{t('profile.raids')}</span>
              {!statsLoaded && (
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{t('app.loading')}</span>
              )}
            </div>
            <div className={styles.battleTop}>
              <WinRateRing wins={wins} losses={losses} />
              <div className={styles.wl}>
                <div className={`${styles.wlRow} ${styles.wlWin}`}>
                  <span className={`${styles.wlPill} ${styles.wlPillWin}`} />
                  <span className={styles.wlKey}>{t('profile.wins')}</span>
                  <span className={styles.wlVal}>{wins}</span>
                </div>
                <div className={`${styles.wlRow} ${styles.wlLoss}`}>
                  <span className={`${styles.wlPill} ${styles.wlPillLoss}`} />
                  <span className={styles.wlKey}>{t('profile.losses')}</span>
                  <span className={styles.wlVal}>{losses}</span>
                </div>
              </div>
            </div>
            <div className={styles.splitBar}>
              <div className={styles.splitWin}  style={{ width: `${winPct}%` }} />
              <div className={styles.splitLoss} style={{ width: `${lossPct}%` }} />
            </div>
            <div className={styles.battleFoot}>
              <div className={styles.mini}>
                <div className={styles.miniKey}>{t('profile.totalRaids')}</div>
                <div className={styles.miniVal}>{total}</div>
              </div>
              <div className={styles.mini}>
                <div className={styles.miniKey}>{t('profile.streak')}</div>
                <div className={styles.miniVal}>{streak} <small>{t('common.in_a_row')}</small></div>
              </div>
            </div>
          </section>

          {/* ── Referral ── */}
          <div className={styles.secLabel}><span className={styles.secDot} />{t('profile.section_friends')}</div>
          <section className={`${styles.card} ${styles.ref}`} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>

            {/* Header row: icon + title + share button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className={styles.refIc}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="8" width="18" height="4" rx="1"/>
                  <path d="M12 8v13M5 12v9h14v-9"/>
                  <path d="M12 8C12 8 11 3 8 3a2.5 2.5 0 0 0 0 5h4z"/>
                  <path d="M12 8s1-5 4-5a2.5 2.5 0 0 1 0 5h-4z"/>
                </svg>
              </div>
              <div className={styles.refTxt} style={{ flex: 1 }}>
                <div className={styles.refT1}>{t('profile.friends')}</div>
                <div className={styles.refT2} style={{ color: refStats && refStats.total > 0 ? '#22d3ee' : undefined }}>
                  {refStats
                    ? t('profile.invitedCount', { count: refStats.total })
                    : t('profile.inviteDesc')}
                </div>
              </div>

              {/* Share button — always visible, right of the title */}
              <button
                onClick={handleShare}
                disabled={shareState === 'loading'}
                title={t('profile.share')}
                style={{
                  flexShrink: 0,
                  width: 44, height: 44, borderRadius: 12,
                  border: '1px solid rgba(6,182,212,0.35)',
                  background: shareState === 'error'
                    ? 'rgba(239,68,68,0.15)'
                    : shareState === 'loading'
                    ? 'rgba(6,182,212,0.08)'
                    : 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(6,182,212,0.1))',
                  color: shareState === 'error' ? '#f87171' : '#22d3ee',
                  cursor: shareState === 'loading' ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s',
                }}
              >
                {shareState === 'loading' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                ) : shareState === 'error' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                ) : (
                  /* Telegram-style paper-plane send icon */
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13"/>
                    <path d="M22 2L15 22 11 13 2 9l20-7z"/>
                  </svg>
                )}
              </button>
            </div>

            {/* Referral link + copy */}
            {refLink && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 10,
                  padding: '8px 12px', fontFamily: 'monospace', fontSize: 11,
                  color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}>
                  {refLink}
                </div>
                <button
                  onClick={copyRefLink}
                  title={t('profile.copyLink')}
                  style={{
                    flexShrink: 0, width: 36, height: 36, borderRadius: 9,
                    background: refCopied ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${refCopied ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    color: refCopied ? '#4ade80' : '#64748b',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {refCopied ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  )}
                </button>
              </div>
            )}

            {/* TON earned + level breakdown */}
            {refStats && refStats.total > 0 && (
              <div style={{ display: 'flex', gap: 8 }}>
                {/* TON earned card */}
                <div style={{
                  flex: 1, background: 'rgba(56,189,248,0.08)', borderRadius: 10,
                  padding: '8px 10px', border: '1px solid rgba(56,189,248,0.2)',
                  display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#38bdf8' }}>
                    ◈ {(refStats.ton_earned ?? 0).toFixed(4)}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>TON заработано</div>
                </div>
                {/* Level counts */}
                {refStats.by_level.map(({ level, count }) => (
                  <div key={level} style={{
                    flex: 1, background: 'rgba(6,182,212,0.08)', borderRadius: 10,
                    padding: '8px 6px', textAlign: 'center',
                    border: '1px solid rgba(6,182,212,0.15)',
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#22d3ee' }}>{count}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                      {t('profile.levelN', { n: level })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recent 5 invites */}
            {refStats && refStats.recent?.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {refStats.recent.slice(0, 5).map((r, i) => {
                  const name = r.username ? `@${r.username}` : [r.first_name, r.last_name].filter(Boolean).join(' ')
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8,
                    }}>
                      <span style={{ fontSize: 13, color: '#cbd5e1' }}>{name}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{
                          fontSize: 11, color: '#22d3ee', background: 'rgba(6,182,212,0.12)',
                          padding: '2px 7px', borderRadius: 6,
                        }}>
                          {t('profile.levelN', { n: r.level })}
                        </span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                          {r.created_at.slice(0, 10)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* "All referrals" link */}
            {refStats && refStats.total > 0 && (
              <button
                onClick={() => setScreen('referrals')}
                style={{
                  width: '100%', padding: '10px', borderRadius: 10,
                  background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.2)',
                  color: '#22d3ee', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'monospace', letterSpacing: 0.3,
                }}
              >
                {t('referrals.allBtn')} ({refStats.total}) →
              </button>
            )}
          </section>

          {/* ── Settings ── */}
          <div ref={settingsRef} className={styles.secLabel}><span className={styles.secDot} />{t('profile.section_settings')}</div>
          <section className={`${styles.card} ${styles.settings}`}>
            {/* Notifications */}
            <div className={styles.setRow} onClick={() => updateNotifications(!allowNotification)}>
              <span className={styles.setIc}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.7 21a2 2 0 0 1-3.4 0"/>
                </svg>
              </span>
              <span className={styles.setKey}>{t('profile.notifs')}</span>
              <div className={`${styles.toggle} ${allowNotification ? styles.toggleOn : styles.toggleOff}`}>
                <div className={styles.toggleKnob} />
              </div>
            </div>

            {/* Duel challenges */}
            <div className={styles.setRow} onClick={() => updateDuelSettings(!allowDuel)}>
              <span className={styles.setIc}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/>
                  <path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                  <path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/>
                  <path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/>
                  <path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/>
                  <path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/>
                  <path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z"/>
                  <path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z"/>
                </svg>
              </span>
              <span className={styles.setKey}>{t('profile.allowDuel')}</span>
              <div className={`${styles.toggle} ${allowDuel ? styles.toggleOn : styles.toggleOff}`}>
                <div className={styles.toggleKnob} />
              </div>
            </div>

            {/* Sound */}
            <div className={styles.setRow} onClick={toggleSound}>
              <span className={styles.setIc}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
              </span>
              <span className={styles.setKey}>{t('profile.sound')}</span>
              <div className={`${styles.toggle} ${soundEnabled ? styles.toggleOn : styles.toggleOff}`}>
                <div className={styles.toggleKnob} />
              </div>
            </div>

            {/* Language switcher */}
            <div className={styles.setRow}>
              <span className={styles.setIc}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9"/>
                  <path d="M3 12h18"/>
                  <path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/>
                </svg>
              </span>
              <span className={styles.setKey}>{t('profile.language')}</span>
              <div style={{display:'flex',gap:6,marginLeft:'auto'}}>
                {(['ru','en'] as const).map((lng) => (
                  <button
                    key={lng}
                    onClick={() => { updateLanguage(lng); i18n.changeLanguage(lng) }}
                    style={{
                      padding:'3px 10px',borderRadius:6,border:'1px solid',fontSize:12,cursor:'pointer',
                      background: language===lng ? '#06b6d4' : 'transparent',
                      color:      language===lng ? '#000' : '#06b6d4',
                      borderColor:'#06b6d4',fontWeight: language===lng ? 700 : 400,
                    }}
                  >
                    {lng === 'ru' ? 'RU' : 'EN'}
                  </button>
                ))}
              </div>
            </div>

            {/* Support */}
            <div className={styles.setRow} style={{ cursor: 'pointer' }} onClick={() => {
              const url = 'https://t.me/cyber_farm_chanel?direct'
              if (tgWebApp?.openTelegramLink) tgWebApp.openTelegramLink(url)
              else window.open(url, '_blank')
            }}>
              <span className={styles.setIc}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9"/>
                  <path d="M9.1 9.2a3 3 0 0 1 5.8 1c0 2-3 2.2-3 4"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </span>
              <span className={styles.setKey}>{t('profile.support')}</span>
              <span className={styles.setChev}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 6l6 6-6 6"/>
                </svg>
              </span>
            </div>
          </section>

        </div>
      </div>

      {/* ── TON Top-up modal ── */}
      {tonModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            zIndex: 700, paddingBottom: 60,
          }}
          onClick={() => setTonModal(false)}
        >
          <div
            style={{
              width: '100%', maxWidth: 420,
              background: '#0f172a', border: '1px solid rgba(54,179,246,0.25)',
              borderRadius: '20px 20px 0 0', padding: '24px 20px 28px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 17, color: '#e2e8f0' }}>
                ◈ {t('profile.tonDeposit')}
              </div>
              <button onClick={() => setTonModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            {invoiceErr && (
              <div style={{ textAlign: 'center', color: '#f87171', padding: '20px 0', fontSize: 14 }}>
                {t('app.error')}
              </div>
            )}

            {!invoice && !invoiceErr && (
              <div style={{ textAlign: 'center', color: '#64748b', padding: '20px 0', fontSize: 14 }}>
                {t('app.loading')}
              </div>
            )}

            {invoice && (
              <>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 16, lineHeight: 1.5 }}>
                  {t('profile.tonDepositDesc')}
                </p>

                {/* QR code */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(invoice.deeplink)}&size=180x180&bgcolor=0f172a&color=e2e8f0&margin=10`}
                    alt="QR TON"
                    width={180}
                    height={180}
                    style={{ borderRadius: 12, border: '1px solid rgba(54,179,246,0.2)' }}
                  />
                </div>

                {/* Wallet address */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{t('profile.walletAddress')}</div>
                  <div
                    style={{
                      background: '#1e293b', borderRadius: 8, padding: '10px 12px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#cbd5e1', wordBreak: 'break-all', flex: 1 }}>
                      {invoice.wallet}
                    </span>
                    <button
                      onClick={() => copyText(invoice.wallet, 'wallet')}
                      style={{ background: 'none', border: 'none', color: copied === 'wallet' ? '#4ade80' : '#36b3f6', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}
                    >
                      {copied === 'wallet' ? '✓' : '⎘'}
                    </button>
                  </div>
                </div>

                {/* Comment */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                    {t('profile.depositComment')}
                    <span style={{ color: '#f87171', marginLeft: 4 }}>★</span>
                  </div>
                  <div
                    style={{
                      background: '#1e293b', borderRadius: 8, padding: '10px 12px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      border: '1px solid rgba(248,113,113,0.25)',
                    }}
                  >
                    <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#fde68a', flex: 1 }}>
                      {invoice.comment}
                    </span>
                    <button
                      onClick={() => copyText(invoice.comment, 'comment')}
                      style={{ background: 'none', border: 'none', color: copied === 'comment' ? '#4ade80' : '#36b3f6', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}
                    >
                      {copied === 'comment' ? '✓' : '⎘'}
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: '#f87171', marginTop: 5 }}>
                    {t('profile.depositCommentWarning')}
                  </div>
                </div>

                {/* Open in wallet */}
                <button
                  onClick={() => window.open(invoice.deeplink, '_blank')}
                  style={{
                    width: '100%', padding: 13,
                    background: 'linear-gradient(135deg, #1e40af, #1d4ed8)',
                    border: '1px solid rgba(54,179,246,0.4)', borderRadius: 12,
                    color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  ◈ {t('profile.openInWallet')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
