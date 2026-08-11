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
    // Founder grant is Voyager-equivalent for feature gates / trip caps.
    return TIER_ORDER.indexOf(TIERS.VOYAGER);
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
  return isAtLeastTier(tier, TIERS.TRAILBLAZER);
}
