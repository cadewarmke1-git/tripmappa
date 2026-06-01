/** POST /api/user-trip-preferences — read/update learned trip preferences. */
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { getUserFromRequest } from "../lib/authFromRequest.js";

function emptyPrefs() {
  return {
    stop_categories: {},
    fuel_brands: {},
    restaurant_types: {},
    avg_stops_per_trip: 0,
    trip_count: 0,
  };
}

function normalizeCategory(stop) {
  const cat = (stop.category || stop.type || "").toLowerCase();
  if (cat.includes("fuel") || cat.includes("diesel") || cat.includes("gas")) return "fuel";
  if (cat.includes("food") || cat.includes("restaurant") || cat.includes("dining")) return "restaurant";
  if (cat.includes("lodging") || cat.includes("hotel")) return "lodging";
  if (cat.includes("weigh")) return "weigh_station";
  if (cat.includes("rest") || cat.includes("break")) return "rest_area";
  if (cat.includes("attraction") || cat.includes("poi")) return "attraction";
  return cat || "other";
}

function extractFuelBrand(stop) {
  const name = String(stop.name || stop.title || "").trim();
  if (!name) return null;
  const brands = [
    "Pilot", "Flying J", "Love's", "TA", "Petro", "Shell", "Chevron",
    "BP", "Exxon", "Mobil", "Speedway", "Casey's", "QuikTrip", "Wawa",
  ];
  for (const brand of brands) {
    if (name.toLowerCase().includes(brand.toLowerCase())) return brand;
  }
  return null;
}

function extractRestaurantType(stop) {
  const name = String(stop.name || stop.title || "").toLowerCase();
  const cuisine = stop.cuisine || stop.restaurantType;
  if (cuisine) return String(cuisine);
  if (name.includes("bbq") || name.includes("barbecue")) return "BBQ";
  if (name.includes("diner")) return "Diner";
  if (name.includes("steakhouse") || name.includes("steak")) return "Steakhouse";
  if (name.includes("mexican") || name.includes("taco")) return "Mexican";
  if (name.includes("pizza")) return "Pizza";
  if (name.includes("cafe") || name.includes("coffee")) return "Cafe";
  return null;
}

export function mergeStopIntoPreferences(existing, stop) {
  const prefs = { ...emptyPrefs(), ...existing };
  const categories = { ...(prefs.stop_categories || {}) };
  const fuelBrands = { ...(prefs.fuel_brands || {}) };
  const restaurantTypes = { ...(prefs.restaurant_types || {}) };

  const category = normalizeCategory(stop);
  categories[category] = (categories[category] || 0) + 1;

  const brand = extractFuelBrand(stop);
  if (brand) fuelBrands[brand] = (fuelBrands[brand] || 0) + 1;

  const restType = extractRestaurantType(stop);
  if (restType) restaurantTypes[restType] = (restaurantTypes[restType] || 0) + 1;

  return {
    ...prefs,
    stop_categories: categories,
    fuel_brands: fuelBrands,
    restaurant_types: restaurantTypes,
  };
}

export function finalizeTripPreferenceStats(existing, tripStopCount = 1) {
  const prefs = { ...emptyPrefs(), ...existing };
  const tripCount = (prefs.trip_count || 0) + 1;
  const prevAvg = Number(prefs.avg_stops_per_trip) || 0;
  const prevTrips = Math.max(0, tripCount - 1);
  const avgStops = prevTrips > 0
    ? ((prevAvg * prevTrips) + tripStopCount) / tripCount
    : tripStopCount;

  return {
    ...prefs,
    avg_stops_per_trip: Math.round(avgStops * 10) / 10,
    trip_count: tripCount,
  };
}

export function formatPreferencesForPrompt(prefs) {
  if (!prefs) return "";
  const lines = ["=== USER LEARNED PREFERENCES (from past trips — weight suggestions toward these) ==="];

  const cats = Object.entries(prefs.stop_categories || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  if (cats.length) {
    lines.push(`Frequently added stop categories: ${cats.map(([k, v]) => `${k} (${v}x)`).join(", ")}`);
  }

  const brands = Object.entries(prefs.fuel_brands || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  if (brands.length) {
    lines.push(`Preferred fuel brands (from stops actually added): ${brands.map(([k, v]) => `${k} (${v}x)`).join(", ")}`);
  }

  const rests = Object.entries(prefs.restaurant_types || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  if (rests.length) {
    lines.push(`Preferred restaurant types: ${rests.map(([k, v]) => `${k} (${v}x)`).join(", ")}`);
  }

  if (prefs.avg_stops_per_trip > 0) {
    lines.push(`Average user-added stops per trip: ${prefs.avg_stops_per_trip}`);
  }

  if (lines.length <= 1) return "";
  return lines.join("\n");
}

export async function readUserTripPreferences(admin, userId) {
  if (!admin || !userId) return null;
  try {
    const { data, error } = await admin
      .from("user_trip_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.warn("readUserTripPreferences:", error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn("readUserTripPreferences failed:", err.message);
    return null;
  }
}

export async function recordUserStopPreferences(admin, userId, stops = [], { tripStopCount = 1, incrementTrip = false } = {}) {
  if (!admin || !userId || !stops?.length) return;
  try {
    const existing = await readUserTripPreferences(admin, userId);
    let merged = existing || emptyPrefs();
    for (const stop of stops) {
      merged = mergeStopIntoPreferences(merged, stop);
    }
    if (incrementTrip) {
      merged = finalizeTripPreferenceStats(merged, tripStopCount);
    }
    const payload = {
      user_id: userId,
      stop_categories: merged.stop_categories,
      fuel_brands: merged.fuel_brands,
      restaurant_types: merged.restaurant_types,
      avg_stops_per_trip: merged.avg_stops_per_trip,
      trip_count: merged.trip_count,
      updated_at: new Date().toISOString(),
    };
    const { error } = await admin
      .from("user_trip_preferences")
      .upsert(payload, { onConflict: "user_id" });
    if (error) console.warn("recordUserStopPreferences:", error.message);
  } catch (err) {
    console.warn("recordUserStopPreferences failed:", err.message);
  }
}

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Database not configured" });
  }

  if (req.method === "GET") {
    const prefs = await readUserTripPreferences(admin, user.id);
    return res.status(200).json({ preferences: prefs || emptyPrefs() });
  }

  if (req.method === "POST") {
    const { stops = [], tripStopCount = 1, incrementTrip = false } = req.body || {};
    if (!Array.isArray(stops) || !stops.length) {
      return res.status(400).json({ error: "stops array is required" });
    }
    await recordUserStopPreferences(admin, user.id, stops, { tripStopCount, incrementTrip });
    const prefs = await readUserTripPreferences(admin, user.id);
    return res.status(200).json({ ok: true, preferences: prefs || emptyPrefs() });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
