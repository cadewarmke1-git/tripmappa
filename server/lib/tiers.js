/** Subscription tiers — server-side mirror of src/lib/tiers.js */

export const TIERS = {
  WANDERER: "wanderer",
  VOYAGER: "voyager",
  TRAILBLAZER: "trailblazer",
  FOUNDER: "founder",
};

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

export function normalizeTier(tier) {
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
  return tier === TIERS.FOUNDER || normalizeTier(tier) === TIERS.FOUNDER;
}

export function canUseGroceryDelivery(tier) {
  return isFounderTier(tier) || isAtLeastTier(tier, TIERS.TRAILBLAZER);
}
