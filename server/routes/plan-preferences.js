import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { getUserFromRequest } from "../lib/authFromRequest.js";

const ALLOWED_KEYS = new Set([
  "vehicle",
  "fuel_type",
  "travelers",
  "lodging",
  "stops_interests",
  "accessibility",
  "trip_budget",
  "dietary",
  "schedule_restrictions",
]);

function sanitizePreferences(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      out[key] = value.filter(v => typeof v === "string" && v.trim()).map(v => v.trim());
      continue;
    }
    if (typeof value === "string") out[key] = value.trim();
  }
  return out;
}

/** GET/PUT /api/plan-preferences — saved defaults for the question flow. */
export default async function handler(req, res) {
  const authUser = await getUserFromRequest(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });

  const admin = getSupabaseAdmin();
  if (!admin) return res.status(503).json({ error: "Database not configured" });

  if (req.method === "GET") {
    const { data, error } = await admin
      .from("user_profiles")
      .select("plan_preferences")
      .eq("user_id", authUser.id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({
      preferences: sanitizePreferences(data?.plan_preferences),
    });
  }

  if (req.method === "PUT") {
    const preferences = sanitizePreferences(req.body?.preferences);
    const { error } = await admin
      .from("user_profiles")
      .upsert(
        { user_id: authUser.id, plan_preferences: preferences },
        { onConflict: "user_id" },
      );
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ preferences });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
