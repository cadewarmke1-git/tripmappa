/** Server-side trip generation credit limits and monthly reset. */
import { canUseGroceryDelivery, hasUnlimitedTripGenerations, normalizeTier } from "./tiers.js";

export const FREE_MONTHLY_LIMIT = 3;

export function currentMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export async function getOrCreateProfile(admin, userId) {
  const { data, error } = await admin
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  const month = currentMonthKey();

  if (data) {
    if (data.credits_month !== month) {
      const { data: updated, error: updateErr } = await admin
        .from("user_profiles")
        .update({ generations_used: 0, credits_month: month })
        .eq("user_id", userId)
        .select()
        .single();
      if (updateErr) throw updateErr;
      return updated;
    }
    return data;
  }

  const { data: created, error: createErr } = await admin
    .from("user_profiles")
    .insert({
      user_id: userId,
      tier: "free",
      generations_used: 0,
      credits_month: month,
    })
    .select()
    .single();

  if (createErr) throw createErr;
  return created;
}

export function getCreditStatus(profile) {
  const tier = normalizeTier(profile.tier);

  if (hasUnlimitedTripGenerations(tier)) {
    return {
      tier,
      unlimited: true,
      remaining: null,
      limit: null,
      used: profile.generations_used,
      groceryDelivery: canUseGroceryDelivery(tier),
    };
  }

  const remaining = Math.max(0, FREE_MONTHLY_LIMIT - profile.generations_used);
  return {
    tier,
    unlimited: false,
    remaining,
    limit: FREE_MONTHLY_LIMIT,
    used: profile.generations_used,
    groceryDelivery: false,
  };
}

export async function fetchCreditStatus(admin, userId) {
  const profile = await getOrCreateProfile(admin, userId);
  return getCreditStatus(profile);
}

export async function consumeCredit(admin, userId) {
  const profile = await getOrCreateProfile(admin, userId);
  const status = getCreditStatus(profile);

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
