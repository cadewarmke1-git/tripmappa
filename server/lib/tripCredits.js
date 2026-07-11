/** Server-side trip generation credit limits by subscription tier. */
import { canUseGroceryDelivery, isFounderTier, TIERS, normalizeTier } from "./tiers.js";
import { expireFounderIfNeeded } from "./foundingMembers.js";
import { expireTrialIfNeeded } from "./trials.js";
import { getEffectiveTier } from "./tierEffective.js";
import { buildReferralLink } from "./referrals.js";
import { isUnlimitedUser } from "./adminAccess.js";
import { buildUserProfileUpsertRow } from "./userProfileDefaults.js";

export const FREE_LIFETIME_LIMIT = 3;
export const VOYAGER_MONTHLY_LIMIT = 20;
export const TRAILBLAZER_MONTHLY_LIMIT = 100;

export function firstOfNextMonthIso(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}

/** Reset monthly allowance only — preserves generation_count and other plan_preferences fields. */
export function resetMonthlyGenerationAllowance(planPrefs = {}) {
  const prefs = planPrefs && typeof planPrefs === "object" && !Array.isArray(planPrefs)
    ? { ...planPrefs }
    : {};
  prefs.monthly_generation_count = 0;
  prefs.monthly_generation_reset_date = firstOfNextMonthIso();
  return prefs;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function ensureMonthlyGenerationPrefs(planPrefs = {}) {
  const prefs = planPrefs && typeof planPrefs === "object" && !Array.isArray(planPrefs)
    ? { ...planPrefs }
    : {};
  const today = todayIso();
  const resetDate = prefs.monthly_generation_reset_date;
  if (!resetDate || today >= resetDate) {
    prefs.monthly_generation_count = 0;
    prefs.monthly_generation_reset_date = firstOfNextMonthIso();
  }
  if (prefs.monthly_generation_count == null || Number.isNaN(Number(prefs.monthly_generation_count))) {
    prefs.monthly_generation_count = 0;
  }
  return prefs;
}

function monthlyLimitForTier(effectiveTier) {
  const normalized = normalizeTier(effectiveTier);
  if (normalized === TIERS.VOYAGER) return VOYAGER_MONTHLY_LIMIT;
  if (normalized === TIERS.TRAILBLAZER || isFounderTier(effectiveTier)) return TRAILBLAZER_MONTHLY_LIMIT;
  return null;
}

function usesMonthlyLimit(effectiveTier, isAdmin) {
  if (isAdmin) return false;
  return monthlyLimitForTier(effectiveTier) != null;
}

async function refreshProfileLifecycle(admin, profile) {
  if (!profile) return profile;
  let next = await expireFounderIfNeeded(admin, profile);
  next = await expireTrialIfNeeded(admin, next);
  return next;
}

async function syncMonthlyPrefsIfNeeded(admin, profile) {
  const effectiveTier = getEffectiveTier(profile);
  const isAdmin = isUnlimitedUser({ userId: profile?.user_id });
  if (!usesMonthlyLimit(effectiveTier, isAdmin)) return profile;

  const rawPrefs = profile.plan_preferences || {};
  const ensured = ensureMonthlyGenerationPrefs(rawPrefs);
  const changed = ensured.monthly_generation_reset_date !== rawPrefs.monthly_generation_reset_date
    || ensured.monthly_generation_count !== rawPrefs.monthly_generation_count;

  if (!changed) {
    return { ...profile, plan_preferences: ensured };
  }

  const { error } = await admin
    .from("user_profiles")
    .update({ plan_preferences: { ...rawPrefs, ...ensured } })
    .eq("user_id", profile.user_id);

  if (error) throw error;
  return { ...profile, plan_preferences: { ...rawPrefs, ...ensured } };
}

export async function getOrCreateProfile(admin, userId) {
  const { data, error } = await admin
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    const refreshed = await refreshProfileLifecycle(admin, data);
    return syncMonthlyPrefsIfNeeded(admin, refreshed);
  }

  const { data: created, error: createErr } = await admin
    .from("user_profiles")
    .insert(buildUserProfileUpsertRow(userId))
    .select()
    .single();

  if (createErr) throw createErr;
  return created;
}

export function getCreditStatus(profile, userId = null, userEmail = null) {
  const effectiveTier = getEffectiveTier(profile);
  const isFounder = isFounderTier(profile.tier);
  const isAdmin = isUnlimitedUser({ userId: userId || profile?.user_id, email: userEmail });
  const groceryDelivery = canUseGroceryDelivery(effectiveTier);
  const planPrefs = ensureMonthlyGenerationPrefs(profile.plan_preferences || {});

  const base = {
    tier: effectiveTier,
    storedTier: profile.tier,
    unlimited: isAdmin,
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
    billingPeriod: usesMonthlyLimit(effectiveTier, isAdmin) ? "monthly" : "lifetime",
    resetDate: planPrefs.monthly_generation_reset_date || null,
  };

  if (isAdmin) {
    return {
      ...base,
      remaining: null,
      limit: null,
      monthlyUsed: null,
    };
  }

  const monthlyLimit = monthlyLimitForTier(effectiveTier);
  if (monthlyLimit != null) {
    const monthlyUsed = Number(planPrefs.monthly_generation_count) || 0;
    const remaining = Math.max(0, monthlyLimit - monthlyUsed);
    return {
      ...base,
      used: monthlyUsed,
      remaining,
      limit: monthlyLimit,
      monthlyUsed,
      monthlyLimit,
    };
  }

  const remaining = Math.max(0, FREE_LIFETIME_LIMIT - profile.generations_used);
  return {
    ...base,
    remaining,
    limit: FREE_LIFETIME_LIMIT,
    monthlyUsed: null,
    monthlyLimit: null,
  };
}

export async function fetchCreditStatus(admin, userId, userEmail = null) {
  const profile = await getOrCreateProfile(admin, userId);
  return getCreditStatus(profile, userId, userEmail);
}

/** Fast pre-flight from client cache — no DB read. Returns null to fall back to DB. */
export function preflightCreditFromClient(clientCredit, userId, userEmail = null) {
  if (!clientCredit || typeof clientCredit !== "object" || Array.isArray(clientCredit)) {
    return null;
  }

  const isAdmin = isUnlimitedUser({ userId, email: userEmail });
  if (clientCredit.unlimited === true) {
    if (!isAdmin) return null;
    return { ok: true, status: { unlimited: true, remaining: null, tier: clientCredit.tier } };
  }

  const remaining = Number(clientCredit.remaining);
  if (Number.isNaN(remaining)) return null;

  if (remaining <= 0) {
    return {
      ok: false,
      status: clientCredit,
      limitReached: true,
      tier: clientCredit.tier,
      resetDate: clientCredit.resetDate || clientCredit.monthly_generation_reset_date || null,
    };
  }

  return { ok: true, status: clientCredit };
}

/** Lightweight DB read before consuming a credit after generation completes. */
export async function validateCreditsBeforeConsume(admin, userId, userEmail = null) {
  const { data, error } = await admin
    .from("user_profiles")
    .select("tier, generations_used, plan_preferences, user_id, founder_expires_at, trailblazer_trial_ends_at, voyager_bonus_until")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  const profile = data || await getOrCreateProfile(admin, userId);
  const status = getCreditStatus(profile, userId, userEmail);

  if (!status.unlimited && (status.remaining ?? 0) <= 0) {
    return { ok: false, ...status, limitReached: true };
  }

  return { ok: true, ...status };
}

export async function consumeCredit(admin, userId, userEmail = null) {
  const profile = await getOrCreateProfile(admin, userId);
  const status = getCreditStatus(profile, userId, userEmail);

  if (!status.unlimited && (status.remaining ?? 0) <= 0) {
    return { ok: false, ...status, limitReached: true };
  }

  if (status.unlimited) {
    return { ok: true, ...status };
  }

  const monthlyLimit = monthlyLimitForTier(status.tier);
  if (monthlyLimit != null) {
    const rawPrefs = profile.plan_preferences || {};
    const planPrefs = ensureMonthlyGenerationPrefs(rawPrefs);
    const nextCount = (Number(planPrefs.monthly_generation_count) || 0) + 1;
    const { error } = await admin
      .from("user_profiles")
      .update({
        plan_preferences: {
          ...rawPrefs,
          ...planPrefs,
          monthly_generation_count: nextCount,
        },
      })
      .eq("user_id", userId);
    if (error) throw error;
    status.monthlyUsed = nextCount;
    status.used = nextCount;
    status.remaining = Math.max(0, monthlyLimit - nextCount);
    return { ok: true, ...status };
  }

  const { error } = await admin
    .from("user_profiles")
    .update({ generations_used: profile.generations_used + 1 })
    .eq("user_id", userId);
  if (error) throw error;
  status.remaining -= 1;
  status.used += 1;
  return { ok: true, ...status };
}
