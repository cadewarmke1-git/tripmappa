import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { getUserFromRequest } from "../lib/authFromRequest.js";
import { tryClaimFoundingSlot } from "../lib/foundingMembers.js";
import { fetchCreditStatus } from "../lib/tripCredits.js";

/** POST /api/founding-claim — assign Founder tier when founding slots remain. */
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

  try {
    const result = await tryClaimFoundingSlot(admin, user.id);
    const status = await fetchCreditStatus(admin, user.id);
    return res.status(200).json({ ...result, credits: status });
  } catch (err) {
    console.error("founding-claim error:", err);
    return res.status(500).json({ error: "Could not process founding membership" });
  }
}
