import { useState, useEffect } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useGameStore } from '../store/gameStore'
import { STARTER_PACK } from '../constants/starter'
import { getShopProducts, buyProduct } from '../api'
import type { ApiProduct } from '../api/types'
import { fmtGold } from '../utils/format'
import styles from './TopUpScreen.module.css'

declare global {
  interface Window {
    Telegram?: { WebApp?: { openInvoice?: (url: string, cb: (status: string) => void) => void } }
  }
}

function ProductCard({ p, onBuy, buying }: { p: ApiProduct; onBuy: () => void; buying: boolean }) {
  const { t } = useTranslation()
  const ratePerStar = Math.round(p.gold_amount / p.stars_price)

  return (
    <div className={styles.card}>
      {p.bonus_label && (
        <div className={styles.bonusBadge}>{p.bonus_label}</div>
      )}
      <div className={styles.cardName}>{p.name}</div>
      {p.description && (
        <div className={styles.cardDesc}>{p.description}</div>
      )}
      <div className={styles.cardGold}>
        <span className={styles.goldIcon}>⬡</span>
        <span className={styles.goldAmt}>{fmtGold(p.gold_amount)}</span>
      </div>
      <div className={styles.cardRate}>{ratePerStar.toLocaleString()} gold / ⭐</div>
      <button
        className={`${styles.buyBtn} ${buying ? styles.buyBtnBusy : ''}`}
        onClick={onBuy}
        disabled={buying}
      >
        {buying ? '...' : `⭐ ${p.stars_price} Stars`}
      </button>
    </div>
  )
}

export function TopUpScreen() {
  const { t } = useTranslation()
  const setScreen    = useGameStore((s) => s.setScreen)
  const loadGameState = useGameStore((s) => s.loadGameState)
  const hasStarsPurchase = useGameStore((s) => s.hasStarsPurchase)

  const [products, setProducts] = useState<ApiProduct[]>([])
  const [loading,  setLoading]  = useState(true)
  const [buyingId, setBuyingId] = useState<number | null>(null)
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null)

  useEffect(() => {
    getShopProducts()
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }, [])

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const handleBuy = async (product: ApiProduct) => {
    if (buyingId) return
    // Client-side guard for one-shot products (Starter Pack): if the user
    // already has any completed Stars purchase, the server will 400 the
    // invoice request. Fail fast with a toast instead of a spinner.
    if (product.is_one_shot && hasStarsPurchase) {
      showToast(t('topup.oneShotUsed'), false)
      return
    }
    setBuyingId(product.id)
    try {
      const { invoice_url } = await buyProduct(product.id)

      const tgWebApp = window.Telegram?.WebApp
      if (tgWebApp?.openInvoice) {
        tgWebApp.openInvoice(invoice_url, (status) => {
          setBuyingId(null)
          if (status === 'paid') {
            showToast(`+${fmtGold(product.gold_amount)} ⬡ зачислено!`, true)
            setTimeout(() => loadGameState(), 1500)
          } else if (status === 'cancelled') {
            showToast(t('topup.cancelled'), false)
          } else {
            showToast(t('topup.failed'), false)
          }
        })
      } else {
        // Dev mode fallback — just show the URL
        showToast('Dev mode: ' + invoice_url, true)
        setBuyingId(null)
      }
    } catch {
      setBuyingId(null)
      showToast(t('topup.failed'), false)
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => setScreen('profile')}>
          {t('common.back')}
        </button>
        <h2 className={styles.title}>{t('topup.title')}</h2>
      </div>

      {toast && (
        <div className={`${styles.toast} ${toast.ok ? styles.toastOk : styles.toastErr}`}>
          {toast.msg}
        </div>
      )}

      {!hasStarsPurchase && (
        <div className={styles.starterHero} data-testid="starter-hero">
          <span className={styles.starterHeroSheen} />
          <div className={styles.starterHeroHeader}>
            <div className={styles.starterHeroTitle}>
              <span className={styles.starterHeroIcon}>🎁</span>
              <span>{t('starter.heroTitle', { stars: STARTER_PACK.stars })}</span>
            </div>
            <div className={styles.starterHeroBadge}>{t('starter.badge')}</div>
          </div>
          <div className={styles.starterHeroSub}>
            <Trans
              i18nKey="starter.heroSubDays"
              count={STARTER_PACK.bonusDays}
              values={{ gold: STARTER_PACK.goldAmount, count: STARTER_PACK.bonusDays }}
              components={{ b: <b /> }}
            />
          </div>
          <div className={styles.starterHeroRow}>
            <span className={styles.starterHeroPrice}>{STARTER_PACK.stars} ⭐</span>
            <span className={styles.starterHeroOld}>{STARTER_PACK.oldStars} ⭐</span>
            <span className={styles.starterHeroBonus}>
              {t('starter.heroBonus', { count: STARTER_PACK.bonusDays })}
            </span>
          </div>
          <div className={styles.starterHeroLimited}>{t('starter.limited')}</div>
        </div>
      )}

      <div className={styles.notice}>
        <span>⭐</span>
        <span>{t('topup.notice')}</span>
      </div>

      {loading ? (
        <div className={styles.empty}>{t('app.loading')}</div>
      ) : products.length === 0 ? (
        <div className={styles.empty}>{t('topup.noProducts')}</div>
      ) : (
        <div className={styles.grid}>
          {products.map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              buying={buyingId === p.id}
              onBuy={() => handleBuy(p)}
            />
          ))}
        </div>
      )}

      <div className={styles.footer}>
        {t('topup.footer')}
      </div>
    </div>
  )
}
