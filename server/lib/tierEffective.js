/** Effective tier including Voyager referral bonuses and active trials. */
import { isFounderTier, normalizeTier, tierRank, TIERS } from "./tiers.js";
import { isOnActiveTrial } from "./trials.js";

export function hasActiveVoyagerBonus(profile) {
  if (!profile?.voyager_bonus_until) return false;
  const ends = new Date(profile.voyager_bonus_until);
  return !Number.isNaN(ends.getTime()) && ends > new Date();
}

export function getEffectiveTier(profile) {
  if (!profile) return TIERS.WANDERER;

  if (isFounderTier(profile.tier)) return TIERS.FOUNDER;

  const paidRank = tierRank(profile.tier);

  if (hasActiveVoyagerBonus(profile) && paidRank < tierRank(TIERS.VOYAGER)) {
    return TIERS.VOYAGER;
  }

  if (isOnActiveTrial(profile) && !profile.stripe_subscription_id) {
    return TIERS.TRAILBLAZER;
  }

  return normalizeTier(profile.tier);
}
