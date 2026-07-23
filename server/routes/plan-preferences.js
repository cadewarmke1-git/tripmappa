import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { getUserFromRequest } from "../lib/authFromRequest.js";
import { buildUserProfileUpsertRow } from "../lib/userProfileDefaults.js";

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
  "preferences",
]);

function emptyStopRejections() {
  return {
    categories: {},
    types: {},
    by_source: {
      itinerary_remove: { categories: {}, types: {} },
      card_hide: { categories: {}, types: {} },
    },
  };
}

function sanitizeCountMap(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const count = Number(value);
    if (!key || !Number.isFinite(count) || count <= 0) continue;
    out[String(key).slice(0, 64)] = Math.min(999, Math.floor(count));
  }
  return out;
}

function sanitizeSourceBucket(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { categories: {}, types: {} };
  }
  return {
    categories: sanitizeCountMap(raw.categories),
    types: sanitizeCountMap(raw.types),
  };
}

/** Rejection learning from remove — stored beside plan prefs, not a parallel table. */
export function sanitizeStopRejections(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyStopRejections();
  const bySourceRaw = raw.by_source && typeof raw.by_source === "object" ? raw.by_source : {};
  return {
    categories: sanitizeCountMap(raw.categories),
    types: sanitizeCountMap(raw.types),
    by_source: {
      itinerary_remove: sanitizeSourceBucket(bySourceRaw.itinerary_remove),
      card_hide: sanitizeSourceBucket(bySourceRaw.card_hide),
    },
  };
}

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

function extractMetadata(raw = {}) {
  const meta = {};
  if (raw.last_generated_preferences && typeof raw.last_generated_preferences === "object") {
    meta.last_generated_preferences = raw.last_generated_preferences;
  }
  if (raw.generation_count != null && !Number.isNaN(Number(raw.generation_count))) {
    meta.generation_count = Number(raw.generation_count);
  }
  if (raw.stop_rejections && typeof raw.stop_rejections === "object") {
    meta.stop_rejections = sanitizeStopRejections(raw.stop_rejections);
  }
  return meta;
}

function buildStoredPreferences(userPrefs, metaOverrides = null, existingRaw = {}) {
  const existingMeta = extractMetadata(existingRaw);
  const meta = { ...existingMeta };
  if (metaOverrides && typeof metaOverrides === "object") {
    if (metaOverrides.last_generated_preferences != null) {
      meta.last_generated_preferences = metaOverrides.last_generated_preferences;
    }
    if (metaOverrides.generation_count != null) {
      meta.generation_count = Number(metaOverrides.generation_count) || 0;
    }
    if (metaOverrides.stop_rejections != null) {
      meta.stop_rejections = sanitizeStopRejections(metaOverrides.stop_rejections);
    }
  }
  return { ...userPrefs, ...meta };
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
    const raw = data?.plan_preferences || {};
    return res.status(200).json({
      preferences: sanitizePreferences(raw),
      meta: extractMetadata(raw),
    });
  }

  if (req.method === "PUT") {
    const { data: existingRow, error: readError } = await admin
      .from("user_profiles")
      .select("plan_preferences")
      .eq("user_id", authUser.id)
      .maybeSingle();
    if (readError) return res.status(500).json({ error: readError.message });

    const existingRaw = existingRow?.plan_preferences || {};
    const userPrefs = sanitizePreferences(req.body?.preferences);
    const metaOverrides = req.body?.meta && typeof req.body.meta === "object" ? req.body.meta : null;
    const stored = buildStoredPreferences(userPrefs, metaOverrides, existingRaw);

    // Preserve credit / monthly fields that live on the same JSON blob but are not form prefs.
    const preserved = {};
    for (const key of ["monthly_generation_count", "monthly_generation_reset_date", "monthly_generation_month"]) {
      if (existingRaw[key] != null && stored[key] == null) preserved[key] = existingRaw[key];
    }

    const { error } = await admin
      .from("user_profiles")
      .upsert(
        buildUserProfileUpsertRow(authUser.id, { plan_preferences: { ...preserved, ...stored } }),
        { onConflict: "user_id" },
      );
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({
      preferences: sanitizePreferences(stored),
      meta: extractMetadata({ ...preserved, ...stored }),
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
