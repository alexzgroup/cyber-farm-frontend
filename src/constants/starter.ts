// Starter Pack promo constants — shown once, before user's first Stars purchase.
// Server is authoritative for both the price (products.stars_price) and the
// shield bonus (Setting: first_stars_bonus_shield_days, default 2). These
// values are used ONLY by the marketing banner/hero UI; actual charge/reward
// come from the /shop/products response and the payment processor.
export const STARTER_PACK = {
  stars:       15,
  goldAmount:  400,
  bonusDays:   2,
  oldStars:    45,
} as const

export const starterDiscountPct = () =>
  Math.round((1 - STARTER_PACK.stars / STARTER_PACK.oldStars) * 100)
