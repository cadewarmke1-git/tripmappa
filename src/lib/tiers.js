/** Subscription tiers — single source of truth for client UI and feature gates. */

export const TIERS = {
  WANDERER: "wanderer",
  VOYAGER: "voyager",
  TRAILBLAZER: "trailblazer",
  FOUNDER: "founder",
};

/** Display order low → high (Founder shares Trailblazer feature rank) */
export const TIER_ORDER = [TIERS.WANDERER, TIERS.VOYAGER, TIERS.TRAILBLAZER];

const LEGACY_TIER_MAP = {
  free: TIERS.WANDERER,
  wanderer: TIERS.WANDERER,
  premium: TIERS.TRAILBLAZER,
  trailblazer: TIERS.TRAILBLAZER,
  traveler: TIERS.VOYAGER,
  voyager: TIERS.VOYAGER,
  founder: TIERS.FOUNDER,
};

export const TIER_PRICING = {
  [TIERS.WANDERER]: {
    label: "Wanderer",
    priceLabel: "Free",
    priceMonthly: 0,
    upgradeUrl: null,
  },
  [TIERS.VOYAGER]: {
    label: "Voyager",
    priceLabel: "$4.99/mo",
    priceMonthly: 4.99,
    upgradeUrl: null,
  },
  [TIERS.TRAILBLAZER]: {
    label: "Trailblazer",
    priceLabel: "$7.99/mo",
    priceMonthly: 7.99,
    upgradeUrl: null,
  },
  [TIERS.FOUNDER]: {
    label: "Founder",
    priceLabel: "Founding 1,000",
    priceMonthly: 0,
    upgradeUrl: null,
  },
};

export const WANDERER_BENEFITS = [
  "3 Trip Generations total",
  "Saved trips and Navigate Home",
  "Maps, routing, and budget estimates",
];

export const VOYAGER_BENEFITS = [
  "Unlimited Trip Generations",
  "Live location sharing",
  "Offline maps",
];

export const TRAILBLAZER_BENEFITS = [
  "Everything in Voyager",
  "Grocery delivery to your hotel",
  "Priority generation queue",
  "Voice-to-list grocery ordering",
];

/** @deprecated use WANDERER_BENEFITS */
export const FREE_BENEFITS = WANDERER_BENEFITS;
/** @deprecated use TRAILBLAZER_BENEFITS */
export const PREMIUM_BENEFITS = TRAILBLAZER_BENEFITS;
/** @deprecated use TRAILBLAZER_BENEFITS */
export const TRAVELER_BENEFITS = TRAILBLAZER_BENEFITS;

export function normalizeTier(tier) {
  if (tier === "guest") return TIERS.WANDERER;
  if (!tier) return TIERS.WANDERER;
  return LEGACY_TIER_MAP[tier] || TIERS.WANDERER;
}

export function tierRank(tier) {
  const normalized = normalizeTier(tier);
  if (normalized === TIERS.FOUNDER) {
    return TIER_ORDER.indexOf(TIERS.TRAILBLAZER);
  }
  const idx = TIER_ORDER.indexOf(normalized);
  return idx >= 0 ? idx : 0;
}

export function isAtLeastTier(currentTier, requiredTier) {
  return tierRank(currentTier) >= tierRank(requiredTier);
}

export function isFounderTier(tier) {
  return tier === TIERS.FOUNDER;
}

export function getTierLabel(tier) {
  const key = normalizeTier(tier);
  if (isFounderTier(tier)) return TIER_PRICING[TIERS.FOUNDER].label;
  return TIER_PRICING[key]?.label || "Wanderer";
}

export function getTierPriceLabel(tier) {
  const key = normalizeTier(tier);
  if (isFounderTier(tier)) return TIER_PRICING[TIERS.FOUNDER].priceLabel;
  return TIER_PRICING[key]?.priceLabel || "Free";
}

export function hasUnlimitedTripGenerations(tier) {
  return isFounderTier(tier) || isAtLeastTier(tier, TIERS.VOYAGER);
}

export function canUseGroceryDelivery(tier) {
  return isFounderTier(tier) || isAtLeastTier(tier, TIERS.TRAILBLAZER);
}

/** Avatar corner star: founder, voyager, or trailblazer (paid tiers only). */
export function getAvatarTierBadge(tier) {
  if (isFounderTier(tier)) return "founder";
  const key = normalizeTier(tier);
  if (key === TIERS.TRAILBLAZER) return "trailblazer";
  if (key === TIERS.VOYAGER) return "voyager";
  return null;
}

export function getTierCssClass(tier) {
  const key = normalizeTier(tier);
  if (isFounderTier(tier)) return "founder";
  if (key === TIERS.TRAILBLAZER) return "trailblazer";
  if (key === TIERS.VOYAGER) return "voyager";
  return "wanderer";
}
