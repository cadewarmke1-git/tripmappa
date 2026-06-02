import { getSupabaseAdmin } from "../../lib/supabaseAdmin.js";
import { getUserFromRequest } from "../../lib/authFromRequest.js";

/** POST /api/trial/dismiss-prompt — clear trial-ended upgrade prompt after user sees it. */
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
    const { error } = await admin
      .from("user_profiles")
      .update({ show_trial_ended_prompt: false })
      .eq("user_id", user.id);

    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("trial/dismiss-prompt error:", err);
    return res.status(500).json({ error: "Could not dismiss prompt" });
  }
}
