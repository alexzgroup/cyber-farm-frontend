import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import styles from './ProfileScreen.module.css'

const MOCK = {
  name: 'Александр Волков',
  initials: 'АВ',
  username: '@alex_volkov',
  tgId: '728 459 102',
  level: 24,
  xp: 1240,
  xpNext: 2000,
  ton: 3.42,
  tonUsd: 18.70,
  wins: 142,
  losses: 67,
  streak: 11,
  season: 4,
  referrals: 8,
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
  const raidLog      = useGameStore((s) => s.raidLog)
  const soundEnabled = useGameStore((s) => s.soundEnabled)
  const toggleSound      = useGameStore((s) => s.toggleSound)
  const language         = useGameStore((s) => s.language)
  const updateLanguage   = useGameStore((s) => s.updateLanguage)
  const { t, i18n }     = useTranslation()
  const [notifs, setNotifs] = useState(true)

  const wins   = raidLog.length > 0 ? raidLog.filter((r) => r.won).length   : MOCK.wins
  const losses = raidLog.length > 0 ? raidLog.filter((r) => !r.won).length  : MOCK.losses
  const total  = wins + losses
  const xpPct  = (MOCK.xp / MOCK.xpNext) * 100

  const winPct  = total > 0 ? Math.round((wins / total) * 100) : Math.round((MOCK.wins / (MOCK.wins + MOCK.losses)) * 100)
  const lossPct = 100 - winPct

  return (
    <div className={styles.screen}>
      {/* Top bar */}
      <div className={styles.topbar}>
        <span className={styles.topbarTitle}>{t('profile.title')}</span>
        <button className={styles.iconBtn} aria-label="Настройки">
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
                <div className={styles.avatarInner}>
                  <span className={styles.initials}>{MOCK.initials}</span>
                </div>
                <span className={styles.onlineDot} />
              </div>
              <div className={styles.heroId}>
                <div className={styles.nameRow}>
                  <span className={styles.name}>{MOCK.name}</span>
                  <svg className={styles.verified} width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l2.4 1.8 3 .1 1 2.8 2.3 1.9-.9 2.9.9 2.9-2.3 1.9-1 2.8-3 .1L12 22l-2.4-1.8-3-.1-1-2.8L3.3 15.4 4.2 12.5l-.9-2.9 2.3-1.9 1-2.8 3-.1L12 2z"/>
                    <path d="M9.5 12.3l1.8 1.8 3.4-3.6" fill="none" stroke="#04121d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className={styles.uname}>{MOCK.username}</div>
                <div className={styles.tgId}>TG ID · {MOCK.tgId}</div>
                <div className={styles.lvlChip}>
                  <svg className={styles.lvlChipIcon} width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>
                  </svg>
                  {t('profile.levelN', {n: MOCK.level})}
                </div>
              </div>
            </div>
            <div className={styles.xp}>
              <div className={styles.xpTop}>
                <span>{t('profile.expTo', {n: MOCK.level + 1})}</span>
                <span><b>{MOCK.xp.toLocaleString('ru')}</b> / {MOCK.xpNext.toLocaleString('ru')} XP</span>
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
              <div className={styles.balAmt}>{Math.floor(balance).toLocaleString('ru')}</div>
              <div className={styles.balSub}>{t('profile.gold')}</div>
            </div>
            <div className={`${styles.card} ${styles.bal} ${styles.balTon}`}>
              <div className={styles.balIc}>
                <svg width="22" height="22" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" fill="#36b3f6"/>
                  <path d="M7 8.6h10c.46 0 .73.5.5.9l-5 8.5a.58.58 0 0 1-1 0l-5-8.5a.58.58 0 0 1 .5-.9z" fill="#fff"/>
                  <path d="M12 9v8.4" stroke="#36b3f6" strokeWidth="1.1"/>
                </svg>
              </div>
              <div className={styles.balAmt}>{MOCK.ton}</div>
              <div className={styles.balSub}>TON <span className={styles.balFiat}>≈ ${MOCK.tonUsd}</span></div>
            </div>
          </div>

          {/* ── Wallet CTA ── */}
          <section className={`${styles.card} ${styles.wallet}`}>
            <div className={styles.walletIc}>
              <svg width="24" height="24" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10.5" fill="#36b3f6"/>
                <path d="M6.7 8.3h10.6c.5 0 .8.55.55.98l-5.3 9.05a.62.62 0 0 1-1.06 0L6.15 9.28a.62.62 0 0 1 .55-.98z" fill="#fff"/>
                <path d="M12 8.8v9.2" stroke="#36b3f6" strokeWidth="1.2"/>
              </svg>
            </div>
            <div className={styles.walletTxt}>
              <div className={styles.walletT1}>
                <span className={styles.walletT1Name}>{t('profile.tonWallet')}</span>
                <span className={styles.walletStat}>{t('profile.notConnected')}</span>
              </div>
              <div className={styles.walletT2}>{t('profile.connectDesc')}</div>
            </div>
            <button className={styles.walletBtn}>{t('profile.connectWallet')}</button>
          </section>

          {/* ── Battle stats ── */}
          <div className={styles.secLabel}><span className={styles.secDot} />{t('profile.section_stats')}</div>
          <section className={`${styles.card} ${styles.battle}`}>
            <div className={styles.battleHead}>
              <span className={styles.battleTitle}>{t('profile.raids')}</span>
              <span className={styles.season}>{t('profile.season', {n: MOCK.season})}</span>
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
                <div className={styles.miniVal}>{MOCK.streak} <small>{t('common.in_a_row')}</small></div>
              </div>
            </div>
          </section>

          {/* ── Referral ── */}
          <div className={styles.secLabel}><span className={styles.secDot} />{t('profile.section_friends')}</div>
          <section className={`${styles.card} ${styles.ref}`}>
            <div className={styles.refIc}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="8" width="18" height="4" rx="1"/>
                <path d="M12 8v13M5 12v9h14v-9"/>
                <path d="M12 8C12 8 11 3 8 3a2.5 2.5 0 0 0 0 5h4z"/>
                <path d="M12 8s1-5 4-5a2.5 2.5 0 0 1 0 5h-4z"/>
              </svg>
            </div>
            <div className={styles.refTxt}>
              <div className={styles.refT1}>{t('profile.friends')}</div>
              <div className={styles.refT2}>{t('profile.inviteDesc', {n: MOCK.referrals})}</div>
            </div>
            <button className={styles.refBtn}>{t('profile.invite')}</button>
          </section>

          {/* ── Settings ── */}
          <div className={styles.secLabel}><span className={styles.secDot} />{t('profile.section_settings')}</div>
          <section className={`${styles.card} ${styles.settings}`}>
            {/* Notifications */}
            <div className={styles.setRow} onClick={() => setNotifs((v) => !v)}>
              <span className={styles.setIc}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.7 21a2 2 0 0 1-3.4 0"/>
                </svg>
              </span>
              <span className={styles.setKey}>{t('profile.notifs')}</span>
              <div className={`${styles.toggle} ${notifs ? styles.toggleOn : styles.toggleOff}`}>
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
            <div className={styles.setRow}>
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
    </div>
  )
}
