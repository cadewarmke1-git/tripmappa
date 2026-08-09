/** POST /api/stop-report — store a stop-scoped quality report from results cards. */
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { getUserFromRequest } from "../lib/authFromRequest.js";
import { captureServerException } from "../lib/sentry.js";
import { guardProxyRoute } from "../lib/apiSecurity.js";

const REASONS = new Set([
  "closed",
  "wrong_location",
  "inaccurate_description",
  "inappropriate",
  "other",
]);

const SOURCE_KINDS = new Set(["road", "restaurant", "lodging", "fuel", "activity"]);

function asOptionalNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asOptionalUuid(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function clipText(value, max) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (guardProxyRoute(req, res, "stop_report")) return undefined;

  const body = req.body || {};
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const sourceKind = typeof body.sourceKind === "string" ? body.sourceKind.trim() : "";
  const stopName = clipText(body.stopName, 200);

  if (!stopName) {
    return res.status(400).json({ error: "stopName is required" });
  }
  if (!REASONS.has(reason)) {
    return res.status(400).json({ error: "Invalid reason" });
  }
  if (!SOURCE_KINDS.has(sourceKind)) {
    return res.status(400).json({ error: "Invalid sourceKind" });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Database not configured" });
  }

  const user = await getUserFromRequest(req);
  const row = {
    user_id: user?.id || null,
    trip_id: asOptionalUuid(body.tripId),
    place_id: clipText(body.placeId, 200),
    stop_name: stopName,
    category: clipText(body.category, 80),
    source_kind: sourceKind,
    lat: asOptionalNumber(body.lat),
    lng: asOptionalNumber(body.lng),
    reason,
    details: clipText(body.details, 1000),
    page_url: clipText(body.pageUrl, 500),
  };

  try {
    const { data, error } = await admin
      .from("stop_reports")
      .insert(row)
      .select("id, created_at")
      .single();

    if (error) throw error;

    return res.status(201).json({
      ok: true,
      id: data.id,
      createdAt: data.created_at,
    });
  } catch (err) {
    console.error("stop-report error:", err);
    captureServerException(err);
    return res.status(500).json({ error: "Could not save report" });
  }
}
