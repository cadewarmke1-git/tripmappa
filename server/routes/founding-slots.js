import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { FOUNDING_MEMBER_MAX, countFoundingMembers } from "../lib/foundingMembers.js";

/** GET /api/founding-slots — public Founder spot counter for hero page. */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Database not configured" });
  }

  try {
    const filled = await countFoundingMembers(admin);
    const remaining = Math.max(0, FOUNDING_MEMBER_MAX - filled);
    return res.status(200).json({
      total: FOUNDING_MEMBER_MAX,
      filled,
      remaining,
    });
  } catch (err) {
    console.error("founding-slots error:", err);
    return res.status(500).json({ error: "Could not load founding slots" });
  }
}
