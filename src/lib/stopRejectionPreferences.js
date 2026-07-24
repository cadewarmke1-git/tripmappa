/**
 * Record rejected/removed stops into user_profiles.plan_preferences (meta.stop_rejections).
 * Same storage blob as plan prefs — no parallel tables.
 *
 * Undo-safe: scheduleStopRejection waits for the undo toast window; cancel clears it
 * so an undone removal never writes a dislike.
 *
 * Source tags: itinerary_remove | card_hide (no new swap UI — only existing remove paths).
 */

import {
  fetchPlanPreferencesFull,
  savePlanPreferencesFull,
} from "./planPreferencesApi.js";

export const REJECTION_SOURCE = {
  itinerary_remove: "itinerary_remove",
  card_hide: "card_hide",
};

export const REJECTION_UNDO_DELAY_MS = 8000;

const pendingRejections = new Map();

export function emptyStopRejections() {
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
    if (key && Number.isFinite(count) && count > 0) out[String(key).slice(0, 64)] = Math.floor(count);
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

export function normalizeRejectionSource(source) {
  if (source === REJECTION_SOURCE.card_hide) return REJECTION_SOURCE.card_hide;
  if (source === REJECTION_SOURCE.itinerary_remove) return REJECTION_SOURCE.itinerary_remove;
  return null;
}

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

/** Aligns with user-trip-preferences category buckets. */
export function normalizeRejectionCategory(stop = {}, kind = null) {
  if (kind === "restaurant") return "restaurant";
  if (kind === "lodging") return "lodging";
  if (kind === "activity") return "attraction";

  const cat = String(stop.category || stop.type || kind || "").toLowerCase();
  if (cat.includes("fuel") || cat.includes("diesel") || cat.includes("gas") || cat.includes("ev") || cat.includes("charg")) {
    return "fuel";
  }
  if (cat.includes("food") || cat.includes("restaurant") || cat.includes("dining")) return "restaurant";
  if (cat.includes("lodging") || cat.includes("hotel") || cat.includes("motel") || cat.includes("rv")) {
    return "lodging";
  }
  if (cat.includes("weigh")) return "weigh_station";
  if (cat.includes("rest") || cat.includes("break")) return "rest_area";
  if (cat.includes("scenic") || cat.includes("overlook") || cat.includes("park") || cat.includes("attraction") || cat.includes("poi") || cat.includes("activity")) {
    return "attraction";
  }
  if (cat === "road") return normalizeRejectionCategory(stop, null);
  return cat && cat !== "road" ? cat : "other";
}

export function extractRejectionType(stop = {}, kind = null) {
  const cuisine = stop.cuisine || stop.restaurantType || stop.restaurant_type;
  if (cuisine) return String(cuisine).trim();

  if (kind === "lodging" || /lodging|hotel/i.test(stop.category || "")) {
    const lodgingType = stop.lodgingType || stop.lodging_type || stop.tier;
    if (lodgingType) return String(lodgingType).trim();
  }

  if (kind === "activity" && stop.interest) return String(stop.interest).trim();

  const name = String(stop.name || stop.title || "").toLowerCase();
  if (name.includes("bbq") || name.includes("barbecue")) return "BBQ";
  if (name.includes("diner")) return "Diner";
  if (name.includes("steakhouse") || name.includes("steak")) return "Steakhouse";
  if (name.includes("mexican") || name.includes("taco")) return "Mexican";
  if (name.includes("pizza")) return "Pizza";
  if (name.includes("cafe") || name.includes("coffee")) return "Cafe";
  if (name.includes("overlook") || name.includes("scenic") || name.includes("viewpoint")) return "scenic";
  if (name.includes("playground")) return "playground";

  const category = String(stop.category || stop.type || "").trim();
  if (category && !/^(road|other|poi)$/i.test(category)) return category;
  return null;
}

export function describeStopRejection(stop = {}, kind = null, source = null) {
  return {
    category: normalizeRejectionCategory(stop, kind),
    type: extractRejectionType(stop, kind),
    source: normalizeRejectionSource(source),
  };
}

function bumpCounts(bucket, category, type) {
  const categories = { ...(bucket.categories || {}) };
  const types = { ...(bucket.types || {}) };
  if (category) categories[category] = (categories[category] || 0) + 1;
  if (type) types[type] = (types[type] || 0) + 1;
  return { categories, types };
}

/**
 * @param {object|null} existing
 * @param {object} stop
 * @param {string|null} kind
 * @param {string|null} source — itinerary_remove | card_hide
 */
export function mergeStopRejection(existing, stop = {}, kind = null, source = null) {
  const base = sanitizeStopRejections(existing);
  const { category, type, source: src } = describeStopRejection(stop, kind, source);
  const aggregate = bumpCounts(base, category, type);
  const by_source = {
    itinerary_remove: { ...base.by_source.itinerary_remove },
    card_hide: { ...base.by_source.card_hide },
  };
  if (src && by_source[src]) {
    by_source[src] = bumpCounts(by_source[src], category, type);
  }
  return {
    categories: aggregate.categories,
    types: aggregate.types,
    by_source,
  };
}

export function rejectionIdentity(stop = {}, kind = null, source = null) {
  const id = stop.id || stop.placeId || stop.name || stop.title || "unknown";
  return `${normalizeRejectionSource(source) || "unknown"}:${kind || "any"}:${id}`;
}

/**
 * Compressed memory line for Claude — token-efficient dislike signal from plan_preferences.meta.stop_rejections.
 * Empty / missing history → "" (omit from prompt).
 */
export function formatStopRejectionsForPrompt(raw, { maxCategories = 4, maxTypes = 4 } = {}) {
  const cleaned = sanitizeStopRejections(raw);
  const cats = Object.entries(cleaned.categories || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCategories);
  const types = Object.entries(cleaned.types || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTypes);
  if (!cats.length && !types.length) return "";

  const lines = [
    "=== STOP REJECTIONS (learned dislikes — deprioritize these; never invent replacements from this list) ===",
  ];
  if (cats.length) {
    lines.push(`Avoid categories: ${cats.map(([k, v]) => `${k} (${v}x)`).join(", ")}`);
  }
  if (types.length) {
    lines.push(`Avoid types: ${types.map(([k, v]) => `${k} (${v}x)`).join(", ")}`);
  }
  return lines.join("\n");
}

/**
 * Defer write until undo window elapses. Returns cancel() — call from Undo.
 * Undone removals must never record a dislike.
 */
export function scheduleStopRejection(accessToken, stop, options = {}) {
  if (!accessToken || !stop) return () => {};
  const {
    kind = null,
    source = REJECTION_SOURCE.itinerary_remove,
    delayMs = REJECTION_UNDO_DELAY_MS,
    planPreferencesRef = null,
    onSaved = null,
    rejectionKey = null,
  } = options;
  const key = rejectionKey || rejectionIdentity(stop, kind, source);
  const prev = pendingRejections.get(key);
  if (prev) clearTimeout(prev);

  const timer = setTimeout(() => {
    pendingRejections.delete(key);
    void recordStopRejection(accessToken, stop, {
      kind,
      source,
      planPreferencesRef,
      onSaved,
    });
  }, delayMs);
  pendingRejections.set(key, timer);

  return () => {
    const active = pendingRejections.get(key);
    if (active) {
      clearTimeout(active);
      pendingRejections.delete(key);
    }
  };
}

/** Test helper — clear pending timers between cases. */
export function clearPendingStopRejections() {
  for (const timer of pendingRejections.values()) clearTimeout(timer);
  pendingRejections.clear();
}

export function pendingStopRejectionCount() {
  return pendingRejections.size;
}

/**
 * Silent write — must never break remove UX.
 */
export async function recordStopRejection(accessToken, stop, options = {}) {
  if (!accessToken || !stop) return null;
  const {
    kind = null,
    source = REJECTION_SOURCE.itinerary_remove,
    planPreferencesRef = null,
    onSaved = null,
  } = options;
  try {
    const { preferences, meta } = await fetchPlanPreferencesFull(accessToken);
    const nextRejections = mergeStopRejection(meta?.stop_rejections, stop, kind, source);
    const nextMeta = { ...meta, stop_rejections: nextRejections };
    const saved = await savePlanPreferencesFull(accessToken, preferences, nextMeta);
    if (planPreferencesRef) {
      planPreferencesRef.current = {
        ...(planPreferencesRef.current || {}),
        ...saved.preferences,
        stop_rejections: saved.meta?.stop_rejections || nextRejections,
      };
    }
    onSaved?.(saved.preferences, saved.meta);
    return saved;
  } catch (err) {
    console.warn("recordStopRejection failed:", err?.message || err);
    return null;
  }
}
