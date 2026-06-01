/** Generation context: recent trips, preference fallbacks, graceful degradation. */
import { getEffectiveVehicle } from "./vehicles.js";

function originRegion(origin) {
  if (!origin) return null;
  const parts = String(origin).split(",").map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) return parts.slice(-2).join(", ");
  return parts[0] || null;
}

export function buildRecentTripsContext(trips = [], limit = 3) {
  const recent = (trips || []).slice(0, limit);
  if (!recent.length) return "";

  const lines = [
    "=== RECENT TRIP HISTORY (soft context — keep recommendations familiar for returning users) ===",
  ];

  recent.forEach((trip, idx) => {
    const vehicle = trip.answers?.vehicle || trip.routeInfo?.vehicleType || "Unknown";
    const region = originRegion(trip.origin);
    const interests = Array.isArray(trip.answers?.stops_interests)
      ? trip.answers.stops_interests.filter(i => i !== "No specific interests").join(", ")
      : null;
    const prefs = Array.isArray(trip.answers?.preferences)
      ? trip.answers.preferences.join(", ")
      : null;
    const added = (trip.roadStops || []).filter(s => s.userAdded).length;

    lines.push(`Trip ${idx + 1}: ${trip.origin || "?"} to ${trip.dest || trip.destination || "?"} | vehicle: ${vehicle}${region ? ` | origin region: ${region}` : ""}`);
    if (interests) lines.push(`  Stop interests: ${interests}`);
    if (prefs) lines.push(`  Route preferences: ${prefs}`);
    if (added > 0) lines.push(`  User-added stops: ${added}`);
  });

  return lines.join("\n");
}

export function preferencesToAnswerFallback(prefs) {
  if (!prefs) return {};
  const out = {};
  const topCategory = Object.entries(prefs.stop_categories || {})
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  if (topCategory && topCategory !== "other") {
    const map = {
      fuel: "Fuel stops",
      restaurant: "Local food",
      lodging: "Scenic viewpoints",
      weigh_station: "Rest areas",
      rest_area: "Rest areas",
      attraction: "Scenic viewpoints",
    };
    const interest = map[topCategory] || "Scenic viewpoints";
    out.stops_interests = [interest];
  }

  const topBrand = Object.entries(prefs.fuel_brands || {})
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  if (topBrand) {
    out.truck_stop_brand = topBrand;
    out.fuel_brand_preference = topBrand;
  }

  const topRest = Object.entries(prefs.restaurant_types || {})
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  if (topRest) {
    out.restaurant_preference = topRest;
  }

  return out;
}

export function resolveAnswersWithFallback(answers = {}, prefs = null) {
  const fallback = preferencesToAnswerFallback(prefs);
  const merged = { ...fallback, ...answers };

  if (!merged.vehicle && fallback.vehicle) merged.vehicle = fallback.vehicle;
  if (!merged.effective_vehicle) merged.effective_vehicle = getEffectiveVehicle(merged);

  if (!merged.stops_interests?.length && fallback.stops_interests) {
    merged.stops_interests = fallback.stops_interests;
  }
  if (!merged.lodging && fallback.lodging) merged.lodging = fallback.lodging;
  if (!merged.preferences?.length && fallback.preferences) merged.preferences = fallback.preferences;
  if (!merged.dietary?.length && fallback.dietary) merged.dietary = fallback.dietary;

  return merged;
}

export function detectAnswerGaps(answers = {}) {
  const gaps = [];
  if (!answers.vehicle) gaps.push("vehicle");
  if (!answers.trip_type) gaps.push("trip_type");
  if (!answers.stops_interests?.length && !answers.preferences?.length) gaps.push("stop_preferences");
  return gaps;
}

export function formatGracefulDegradationNotes(answers, prefs, gaps = []) {
  if (!gaps.length && !prefs) return "";
  const lines = ["=== GRACEFUL DEGRADATION (proceed with best available context) ==="];
  if (gaps.length) {
    lines.push(`Missing or incomplete answers: ${gaps.join(", ")}. Use saved user preferences and route context as fallback — do not fail or return a generic trip.`);
  }
  if (prefs?.trip_count > 0) {
    lines.push("Saved user preference history is available — prioritize it over generic defaults for any missing fields.");
  }
  return lines.join("\n");
}

export async function fetchUserTripPreferences(accessToken) {
  if (!accessToken) return null;
  try {
    const res = await fetch("/api/user-trip-preferences", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.preferences || null;
  } catch {
    return null;
  }
}

export async function recordUserStopPreferences(accessToken, stops, tripStopCount = 1, { incrementTrip = false } = {}) {
  if (!accessToken || !stops?.length) return;
  try {
    await fetch("/api/user-trip-preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ stops, tripStopCount, incrementTrip }),
    });
  } catch {
    // silent — must not break generation flow
  }
}
