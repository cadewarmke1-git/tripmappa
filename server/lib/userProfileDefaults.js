/** Safe defaults for user_profiles INSERT/upsert rows (avoids tier CHECK 23514 on partial upserts). */

export function currentMonthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export function firstOfNextMonthIso(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}

export function defaultPlanPreferences() {
  return {
    monthly_generation_count: 0,
    monthly_generation_reset_date: firstOfNextMonthIso(),
  };
}

/**
 * Base row for user_profiles upsert when the row may not exist yet.
 * Spreads overrides last so callers can patch tier, referral_code, plan_preferences, etc.
 */
export function buildUserProfileUpsertRow(userId, overrides = {}) {
  return {
    user_id: userId,
    tier: "wanderer",
    generations_used: 0,
    credits_month: currentMonthKey(),
    plan_preferences: defaultPlanPreferences(),
    ...overrides,
  };
}
