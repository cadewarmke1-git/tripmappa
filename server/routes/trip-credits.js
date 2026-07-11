import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { captureServerException } from "../lib/sentry.js";
import { getUserFromRequest } from "../lib/authFromRequest.js";
import { fetchCreditStatus } from "../lib/tripCredits.js";
import { ensureReferralCode } from "../lib/referrals.js";

/** GET /api/trip-credits — remaining AI generations for signed-in user. */
export default async function handler(req, res) {
  if (req.method !== "GET") {
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

  try {
    await ensureReferralCode(admin, user.id);
    const status = await fetchCreditStatus(admin, user.id, user.email);
    return res.status(200).json(status);
  } catch (err) {
    console.error("trip-credits error:", err);
    captureServerException(err);
    return res.status(500).json({ error: "Could not load credits" });
  }
}
