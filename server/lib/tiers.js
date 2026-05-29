/** Subscription tiers — server-side mirror of src/lib/tiers.js */

export const TIERS = {
  FREE: "free",
  PREMIUM: "premium",
  TRAVELER: "traveler",
};

export const TIER_ORDER = [TIERS.FREE, TIERS.PREMIUM, TIERS.TRAVELER];

export function normalizeTier(tier) {
  if (tier === TIERS.TRAVELER || tier === TIERS.PREMIUM) return tier;
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

export function hasUnlimitedTripGenerations(tier) {
  return isAtLeastTier(tier, TIERS.PREMIUM);
}

export function canUseGroceryDelivery(tier) {
  return normalizeTier(tier) === TIERS.TRAVELER;
}
