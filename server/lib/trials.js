/** 7-day Trailblazer trial for non-Founder signups. */
import { buildUserProfileUpsertRow } from "./userProfileDefaults.js";

export const TRIAL_DAYS = 7;

export function trialEndFromNow(days = TRIAL_DAYS) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function isOnActiveTrial(profile) {
  if (!profile?.trailblazer_trial_ends_at) return false;
  const ends = new Date(profile.trailblazer_trial_ends_at);
  return !Number.isNaN(ends.getTime()) && ends > new Date();
}

export async function startTrailblazerTrial(admin, userId) {
  const endsAt = trialEndFromNow();
  const { error } = await admin.from("user_profiles").upsert(
    buildUserProfileUpsertRow(userId, {
      tier: "trailblazer",
      trailblazer_trial_ends_at: endsAt,
      show_trial_ended_prompt: false,
    }),
    { onConflict: "user_id" },
  );
  if (error) throw error;
  return endsAt;
}

/** Downgrade expired trial users without a paid subscription. */
export async function expireTrialIfNeeded(admin, profile) {
  if (!profile) return profile;

  const hasPaidSub = Boolean(profile.stripe_subscription_id);
  if (hasPaidSub) return profile;

  const trialEnds = profile.trailblazer_trial_ends_at
    ? new Date(profile.trailblazer_trial_ends_at)
    : null;

  if (!trialEnds || Number.isNaN(trialEnds.getTime()) || trialEnds > new Date()) {
    return profile;
  }

  if (profile.tier !== "trailblazer" && profile.tier !== "founder") {
    return profile;
  }

  if (profile.tier === "founder") return profile;

  const { data, error } = await admin
    .from("user_profiles")
    .update({
      tier: "wanderer",
      trailblazer_trial_ends_at: null,
      show_trial_ended_prompt: true,
    })
    .eq("user_id", profile.user_id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function formatEmailDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "soon";
  }
}
