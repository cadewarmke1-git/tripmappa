/** Server-side trip generation credit limits (3 lifetime for Wanderer, unlimited for paid tiers). */
import { canUseGroceryDelivery, hasUnlimitedTripGenerations, isFounderTier } from "./tiers.js";
import { expireFounderIfNeeded } from "./foundingMembers.js";
import { expireTrialIfNeeded } from "./trials.js";
import { getEffectiveTier } from "./tierEffective.js";
import { buildReferralLink } from "./referrals.js";
import { isExemptFounderUser } from "./foundingMembers.js";

export const FREE_LIFETIME_LIMIT = 3;

/** @deprecated use FREE_LIFETIME_LIMIT */
export const FREE_MONTHLY_LIMIT = FREE_LIFETIME_LIMIT;

export function currentMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

async function refreshProfileLifecycle(admin, profile) {
  if (!profile) return profile;
  let next = await expireFounderIfNeeded(admin, profile);
  next = await expireTrialIfNeeded(admin, next);
  return next;
}

export async function getOrCreateProfile(admin, userId) {
  const { data, error } = await admin
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    return refreshProfileLifecycle(admin, data);
  }

  const month = currentMonthKey();
  const { data: created, error: createErr } = await admin
    .from("user_profiles")
    .insert({
      user_id: userId,
      tier: "wanderer",
      generations_used: 0,
      credits_month: month,
    })
    .select()
    .single();

  if (createErr) throw createErr;
  return created;
}

export function getCreditStatus(profile, userId = null) {
  const effectiveTier = getEffectiveTier(profile);
  const isFounder = isFounderTier(profile.tier);
  const isAdmin = isExemptFounderUser(userId || profile?.user_id);
  const unlimited = isAdmin || hasUnlimitedTripGenerations(effectiveTier);
  const groceryDelivery = canUseGroceryDelivery(effectiveTier);

  const base = {
    tier: effectiveTier,
    storedTier: profile.tier,
    unlimited,
    used: profile.generations_used,
    groceryDelivery,
    stripeCustomerId: profile.stripe_customer_id || null,
    isFounder,
    founderExpiresAt: profile.founder_expires_at || null,
    voyagerBonusUntil: profile.voyager_bonus_until || null,
    trialEndsAt: profile.trailblazer_trial_ends_at || null,
    referralCode: profile.referral_code || null,
    referralLink: buildReferralLink(profile.referral_code),
    showTrialEndedPrompt: Boolean(profile.show_trial_ended_prompt),
    isAdmin,
  };

  if (unlimited) {
    return {
      ...base,
      remaining: null,
      limit: null,
    };
  }

  const remaining = Math.max(0, FREE_LIFETIME_LIMIT - profile.generations_used);
  return {
    ...base,
    remaining,
    limit: FREE_LIFETIME_LIMIT,
  };
}

export async function fetchCreditStatus(admin, userId) {
  const profile = await getOrCreateProfile(admin, userId);
  return getCreditStatus(profile, userId);
}

export async function consumeCredit(admin, userId) {
  const profile = await getOrCreateProfile(admin, userId);
  const status = getCreditStatus(profile, userId);

  if (!status.unlimited && status.remaining <= 0) {
    return { ok: false, ...status };
  }

  if (!status.unlimited) {
    const { error } = await admin
      .from("user_profiles")
      .update({ generations_used: profile.generations_used + 1 })
      .eq("user_id", userId);
    if (error) throw error;
    status.remaining -= 1;
    status.used += 1;
  }

  return { ok: true, ...status };
}
