import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { getUserFromRequest } from "../lib/authFromRequest.js";
import { tryClaimFoundingSlot } from "../lib/foundingMembers.js";
import {
  ensureReferralCode,
  processReferralSignup,
  buildReferralLink,
} from "../lib/referrals.js";
import { startTrailblazerTrial } from "../lib/trials.js";
import { fetchCreditStatus, getOrCreateProfile } from "../lib/tripCredits.js";

/** POST /api/account-onboarding — referral code, founding slot, and Trailblazer trial setup. */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Database not configured" });
  }

  const { refCode } = req.body || {};

  try {
    await ensureReferralCode(admin, user.id);

    let referral = { applied: false };
    if (refCode) {
      referral = await processReferralSignup(admin, user.id, refCode);
    }

    const founder = await tryClaimFoundingSlot(admin, user.id);

    let profile = await getOrCreateProfile(admin, user.id);

    const shouldStartTrial =
      profile.tier === "wanderer"
      && !profile.stripe_subscription_id
      && !profile.trailblazer_trial_ends_at;

    if (shouldStartTrial) {
      await startTrailblazerTrial(admin, user.id);
      profile = await getOrCreateProfile(admin, user.id);
    }

    const credits = await fetchCreditStatus(admin, user.id, user.email);

    return res.status(200).json({
      referral,
      founder,
      trialStarted: Boolean(shouldStartTrial),
      referralLink: buildReferralLink(credits.referralCode),
      credits,
    });
  } catch (err) {
    console.error("account-onboarding error:", err);
    return res.status(500).json({ error: "Could not complete account setup" });
  }
}
