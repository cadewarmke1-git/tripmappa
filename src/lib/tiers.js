/** Subscription tiers — single source of truth for client UI and feature gates. */

export const TIERS = {
  FREE: "free",
  PREMIUM: "premium",
  TRAVELER: "traveler",
};

/** Display order low → high */
export const TIER_ORDER = [TIERS.FREE, TIERS.PREMIUM, TIERS.TRAVELER];

export const TIER_PRICING = {
  [TIERS.FREE]: {
    label: "Free",
    priceLabel: "Free",
    priceMonthly: 0,
    upgradeUrl: null,
  },
  [TIERS.PREMIUM]: {
    label: "Premium",
    priceLabel: "$7.99/mo",
    priceMonthly: 7.99,
    upgradeUrl: "https://tripmappa.com/upgrade",
  },
  [TIERS.TRAVELER]: {
    label: "Traveler",
    priceLabel: "$14.99/mo",
    priceMonthly: 14.99,
    upgradeUrl: "https://tripmappa.com/upgrade/traveler",
  },
};

export const FREE_BENEFITS = [
  "3 Trip Generations per month",
  "Saved trips and Navigate Home",
  "Maps, routing, and budget estimates",
];

export const PREMIUM_BENEFITS = [
  "Unlimited Trip Generations",
  "Live location sharing",
  "Offline maps",
  "Priority generation queue",
];

export const TRAVELER_BENEFITS = [
  "Everything in Premium",
  "Grocery delivery to your hotel",
  "Voice-to-list ordering",
  "Scheduled delivery before arrival",
];

export function normalizeTier(tier) {
  if (tier === TIERS.TRAVELER || tier === TIERS.PREMIUM) return tier;
  if (tier === "guest") return TIERS.FREE;
  return TIERS.FREE;
}

export function tierRank(tier) {
  const normalized = normalizeTier(tier);
  const idx = TIER_ORDER.indexOf(normalized);
  return idx >= 0 ? idx : 0;
}

export function isAtLeastTier(currentTier, requiredTier) {
  return tierRank(currentTier) >= tierRank(requiredTier);
}

export function getTierLabel(tier) {
  return TIER_PRICING[normalizeTier(tier)]?.label || "Free";
}

export function getTierPriceLabel(tier) {
  return TIER_PRICING[normalizeTier(tier)]?.priceLabel || "Free";
}

export function hasUnlimitedTripGenerations(tier) {
  return isAtLeastTier(tier, TIERS.PREMIUM);
}

export function canUseGroceryDelivery(tier) {
  return normalizeTier(tier) === TIERS.TRAVELER;
}

export function getUpgradeUrl(tier) {
  return TIER_PRICING[normalizeTier(tier)]?.upgradeUrl || TIER_PRICING[TIERS.PREMIUM].upgradeUrl;
}
