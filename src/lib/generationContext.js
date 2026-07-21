/** Generation context: recent trips, preference fallbacks, graceful degradation. */
import {
  getEffectiveVehicle,
  isTruckVehicle,
  isWaterVehicle,
  MULTI_VEHICLE_TRIP,
  formatTravelersLabel,
} from "./vehicles.js";
import { asArray } from "./tripAccommodations.js";
import { isContinuousDrive } from "./driveMode.js";
import {
  getScheduleRestrictionLabels,
  SCHEDULE_TRAVEL_SPECIFIC_HOURS,
  SCHEDULE_NO_RESTRICTIONS,
} from "./scheduleRestrictions.js";
import { resolveTripsForContext } from "./tripHistoryAnalysis.js";
import { travelerProfileToFlowPrefill } from "./travelerOnboarding.js";

export {
  buildRecentTripsPreferencesRollup,
  buildUserPatternSummary,
  resolveTripsForContext,
} from "./tripHistoryAnalysis.js";

export function formatMultiVehicleCoordinationBlock(answers = {}) {
  const coordination = asArray(answers.coordination_needs).filter(Boolean);
  if (answers.vehicle !== MULTI_VEHICLE_TRIP || !coordination.length) return "";
  return [
    "=== MULTI-VEHICLE COORDINATION (HIGH PRIORITY — group travel constraints) ===",
    coordination.join("; "),
  ].join("\n");
}

/** Explicit no-restriction signals when user chose "Defaults are fine" on trip_details. */
export function formatTripDetailsDefaultSignals(answers = {}) {
  if (!answers.trip_details_defaults_confirmed) return [];

  const lines = [];
  const dietary = asArray(answers.dietary).filter(d => d && d !== "No restrictions");
  if (!dietary.length) lines.push("User confirmed no dietary restrictions");

  const accessibility = asArray(answers.accessibility).filter(a => a && a !== "No special needs");
  if (!accessibility.length) lines.push("User confirmed no accessibility needs");

  const schedule = getScheduleRestrictionLabels(answers);
  if (!schedule.length) lines.push("User confirmed no schedule constraints");

  const interests = asArray(answers.stops_interests).filter(i => i && i !== "No specific interests");
  if (!interests.length) lines.push("User confirmed no specific stop interests");

  if (!answers.trip_budget || answers.trip_budget === "No budget limit") {
    lines.push("User confirmed no trip budget cap");
  }

  return lines;
}

/** Family / kids context for Sonnet when young children are traveling. */
export function formatFamilyContextHints(answers = {}) {
  const lines = [];
  const kidsAges = asArray(answers.kids_ages).filter(Boolean);
  const childCount = Number(answers.child_count) || 0;
  const skipSelected = kidsAges.some(a => /not sure|prefer not to say/i.test(a));
  if (skipSelected) {
    lines.push("Children's ages not specified — use conservative family-friendly defaults for stops, pacing, and rest breaks.");
    return lines;
  }
  if (kidsAges.length) {
    lines.push(`Children's ages on this trip: ${kidsAges.join(", ")}`);
    lines.push("MUST: Recommend age-appropriate stops, family-friendly restaurants, and shorter drive segments where young children are present.");
    if (kidsAges.some(a => /Infants|Toddlers/i.test(a))) {
      lines.push("MUST: Include frequent rest breaks and easy-access facilities — infants or toddlers are traveling.");
    }
  } else if (childCount > 0) {
    lines.push(`Traveling with ${childCount} child${childCount === 1 ? "" : "ren"} — ages not specified, recommend family-friendly stops suitable for all ages.`);
  } else if (asArray(answers.accessibility).includes("Traveling with young children")) {
    lines.push("Traveling with young children — favor family-friendly stops and shorter legs between breaks.");
  }
  return lines;
}

function isThinTransportAnswers(answers = {}) {
  const effective = getEffectiveVehicle(answers);
  return effective === "Plane" || effective === "Ferry" || isWaterVehicle(effective);
}

export { isThinTransportAnswers };

/** Sanitize schedule restriction labels for generationHints (travel vs drive wording). */
export function formatScheduleConstraintForHints(answers = {}) {
  if (answers.schedule_restrictions == null) return "";

  const raw = asArray(answers.schedule_restrictions);
  if (raw.includes(SCHEDULE_NO_RESTRICTIONS)) {
    return "Fully flexible — no time restrictions on driving or stops";
  }

  const isTravel = isThinTransportAnswers(answers);
  const isTruck = isTruckVehicle(getEffectiveVehicle(answers));
  const schedule = getScheduleRestrictionLabels(answers).map((entry) => {
    if (isTravel && /drive only during specific hours/i.test(entry)) {
      return SCHEDULE_TRAVEL_SPECIFIC_HOURS;
    }
    return entry;
  });
  if (schedule.length) {
    let val = schedule.join(", ");
    const hours = answers.schedule_drive_hours?.trim();
    if (hours) {
      const hoursLabel = isTravel
        ? "preferred travel hours"
        : isTruck
          ? "preferred hours on the road"
          : "preferred drive hours";
      val += ` (${hoursLabel}: ${hours})`;
    }
    return val;
  }

  return "No restrictions — travel any time";
}

/** Party size line for generationHints — bucket, adult/child split, and kids age bands when present. */
export function formatTravelersContextLines(answers = {}) {
  if (!answers.travelers && answers.adult_count == null) return [];

  let line = `Travelers: ${formatTravelersLabel(answers.travelers) || "Not specified"}`;
  if (answers.adult_count != null && answers.child_count != null) {
    const adults = Number(answers.adult_count);
    const children = Number(answers.child_count);
    line += ` (${adults} adult${adults === 1 ? "" : "s"}, ${children} child${children === 1 ? "" : "ren"})`;
  }

  const kidsAges = asArray(answers.kids_ages).filter(a => a && !/not sure|prefer not to say/i.test(a));
  if (kidsAges.length) {
    line += ` (including children ages: ${kidsAges.join(", ")})`;
  }

  return [line];
}

export function formatTripNightsLine(answers = {}) {
  if (!answers.trip_nights) return "";
  return `Planned overnight stops: ${answers.trip_nights}`;
}

export function formatStopCountLine(answers = {}) {
  if (!answers.stop_count) return "";
  return `Preferred stop count: ${answers.stop_count}`;
}

export function formatStopFrequencyLine(answers = {}) {
  if (!answers.stop_frequency) return "";
  const guidance = {
    Minimal: "Include only essential fuel/rest stops — keep optional detours sparse.",
    Moderate: "Include a few breaks plus one or two optional points of interest.",
    Frequent: "Favor lots of optional stops — take it slow and explore along the route.",
  };
  const tip = guidance[answers.stop_frequency] || "Match optional stop density to this preference.";
  return `Stop frequency: ${answers.stop_frequency}. ${tip}`;
}

export function formatLuxuryLevelLine(answers = {}) {
  if (!answers.luxury_level) return "";
  const hasOvernight = !isContinuousDrive(answers)
    && answers.lodging !== "No overnight stay"
    && answers.overnight_preference !== "Drive straight through"
    && Boolean(
      answers.lodging
      || answers.trip_nights
      || answers.overnight_preference === "Stop overnight along the way",
    );
  const tiers = hasOvernight
    ? {
      1: "1-star Budget (under $80/night hotels, casual dining)",
      2: "2-star Economy ($80–120/night, sit-down restaurants)",
      3: "3-star Mid-range ($120–180/night, quality dining)",
      4: "4-star Upscale ($180–250/night, fine dining)",
      5: "5-star Luxury ($250+/night, premium lodging and dining)",
    }
    : {
      1: "1-star Budget (casual dining)",
      2: "2-star Economy (sit-down restaurants)",
      3: "3-star Mid-range (quality dining)",
      4: "4-star Upscale (fine dining)",
      5: "5-star Luxury (premium dining)",
    };
  const label = tiers[String(answers.luxury_level)] || `${answers.luxury_level}-star`;
  return hasOvernight
    ? `Hotel & restaurant budget level: ${label}. Use this luxury_level when selecting hotels and restaurants.`
    : `Restaurant budget level: ${label}. Use this luxury_level when selecting restaurants (no overnight lodging on this trip).`;
}

export function formatPetConstraintLine(answers = {}) {
  if (!asArray(answers.preferences).includes("Pet friendly")) return "";
  return "Traveling with a pet — all stop and lodging recommendations must be pet-friendly";
}

/** Truck-specific block for commercial routes — hauling, sleeper, stops, HOS. */
export function formatTruckContextBlock(answers = {}) {
  const effective = getEffectiveVehicle(answers);
  if (!isTruckVehicle(effective)) return "";

  const lines = ["=== TRUCK CONTEXT ==="];
  if (answers.hauling_type) lines.push(`Hauling type: ${answers.hauling_type}`);
  if (answers.sleeper_cab) {
    lines.push(`Sleeper cab: ${answers.sleeper_cab}`);
    if (/^No/i.test(String(answers.sleeper_cab)) && answers.lodging) {
      lines.push(`External lodging tier (no sleeper): ${answers.lodging}`);
    }
  }
  const stopBrand = answers.truck_stop_brand || answers.truck_stop_preference;
  if (stopBrand) lines.push(`Preferred truck stop brand: ${stopBrand}`);

  const restrictions = asArray(answers.route_restrictions).filter(r => r && r !== "No restrictions");
  lines.push(`Route restrictions: ${restrictions.length ? restrictions.join(", ") : "None"}`);

  if (answers.hos_compliance) {
    lines.push("HOS compliance: Required — plan mandatory breaks and overnight stops per FMCSA hours-of-service rules.");
  }

  return lines.join("\n");
}

function originRegion(origin) {
  if (!origin) return null;
  const parts = String(origin).split(",").map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) return parts.slice(-2).join(", ");
  return parts[0] || null;
}

const RECENT_TRIPS_CONTEXT_MAX_CHARS = 1400;

function summarizeDietary(answers = {}) {
  return asArray(answers.dietary).filter(d => d && d !== "No restrictions");
}

function summarizeAccessibility(answers = {}) {
  return asArray(answers.accessibility).filter(a => a && a !== "No special needs");
}

function tripHasPetFriendly(answers = {}) {
  return asArray(answers.preferences).includes("Pet friendly");
}

function formatPartySummary(answers = {}) {
  if (!answers.travelers && answers.adult_count == null) return null;
  let line = formatTravelersLabel(answers.travelers) || "Not specified";
  if (answers.adult_count != null && answers.child_count != null) {
    const adults = Number(answers.adult_count);
    const children = Number(answers.child_count);
    line += ` (${adults} adult${adults === 1 ? "" : "s"}, ${children} child${children === 1 ? "" : "ren"})`;
  }
  return line;
}

function truncateContextBlock(lines, maxChars) {
  let text = lines.join("\n");
  if (text.length <= maxChars) return text;
  const header = lines[0];
  const body = lines.slice(1);
  while (body.length > 1 && `${header}\n${body.join("\n")}`.length > maxChars) {
    body.pop();
  }
  text = `${header}\n${body.join("\n")}`;
  if (text.length > maxChars) text = text.slice(0, maxChars - 3) + "...";
  if (body.length < lines.length - 1) text += "\n  (older trip details omitted for length)";
  return text;
}

function formatRecentTripBlock(trip, idx) {
  const answers = trip.answers || {};
  const dest = trip.dest || trip.destination || "?";
  const lines = [`Trip ${idx + 1}: ${trip.origin || "?"} → ${dest}`];

  const headline = [];
  const vehicle = answers.vehicle || trip.routeInfo?.vehicleType;
  if (vehicle) headline.push(`vehicle ${vehicle}`);
  const region = originRegion(trip.origin);
  if (region) headline.push(`from ${region}`);
  if (answers.fuel_type) headline.push(`fuel ${answers.fuel_type}`);
  if (headline.length) lines.push(`  ${headline.join(" · ")}`);

  const party = formatPartySummary(answers);
  if (party) lines.push(`  Party: ${party}`);

  const dietary = summarizeDietary(answers);
  if (dietary.length) lines.push(`  Diet: ${dietary.join(", ")}`);

  const accessibility = summarizeAccessibility(answers);
  if (accessibility.length) lines.push(`  Access/medical: ${accessibility.join(", ")}`);

  const schedule = getScheduleRestrictionLabels(answers);
  if (schedule.length) {
    let sched = schedule.join(", ");
    if (answers.schedule_drive_hours?.trim()) sched += ` (${answers.schedule_drive_hours.trim()})`;
    lines.push(`  Schedule: ${sched}`);
  }

  if (answers.trip_budget && answers.trip_budget !== "No budget limit") {
    lines.push(`  Budget: ${answers.trip_budget}`);
  }
  if (answers.lodging) lines.push(`  Lodging: ${answers.lodging}`);
  if (answers.trip_nights) lines.push(`  Nights: ${answers.trip_nights}`);

  if (tripHasPetFriendly(answers)) lines.push("  Pet: traveling with pet (pet-friendly)");

  const interests = asArray(answers.stops_interests)
    .filter(i => i && i !== "No specific interests");
  if (interests.length) lines.push(`  Stop interests: ${interests.join(", ")}`);

  const prefs = asArray(answers.preferences).filter(Boolean);
  if (prefs.length) lines.push(`  Route prefs: ${prefs.join(", ")}`);

  const added = (trip.roadStops || []).filter(s => s.userAdded).length;
  if (added > 0) lines.push(`  User-added stops: ${added}`);

  return lines;
}

export function buildRecentTripsContext(tripsOrRef = [], limit = 3) {
  const recent = resolveTripsForContext(tripsOrRef).slice(0, limit);
  if (!recent.length) return "";

  const lines = [
    "=== RECENT TRIP HISTORY (soft context — keep recommendations familiar for returning users) ===",
  ];

  recent.forEach((trip, idx) => {
    lines.push(...formatRecentTripBlock(trip, idx));
  });

  return truncateContextBlock(lines, RECENT_TRIPS_CONTEXT_MAX_CHARS);
}

const ROUTE_SPECIFIC_PREFILL_KEYS = new Set([
  "lodging",
  "overnight_preference",
  "continuous_drive",
  "loyalty_program",
  "route_context_unavailable",
]);

const PLAN_VEHICLE_ALIASES = {
  SUV: "SUV or Van",
  "Semi Truck": "Semi Truck (18-wheeler)",
  "Multi-vehicle trip": MULTI_VEHICLE_TRIP,
};

/** Map saved plan preferences (user_profiles.plan_preferences) to question-flow prefill. */
export function planPreferencesToFlowPrefill(planPrefs = {}) {
  if (!planPrefs || typeof planPrefs !== "object") return {};
  const out = {};
  if (planPrefs.vehicle) {
    out.vehicle = PLAN_VEHICLE_ALIASES[planPrefs.vehicle] || planPrefs.vehicle;
  }
  if (planPrefs.fuel_type) out.fuel_type = planPrefs.fuel_type;
  if (planPrefs.travelers) out.travelers = planPrefs.travelers;
  if (Array.isArray(planPrefs.dietary) && planPrefs.dietary.length) out.dietary = [...planPrefs.dietary];
  if (Array.isArray(planPrefs.accessibility) && planPrefs.accessibility.length) out.accessibility = [...planPrefs.accessibility];
  if (Array.isArray(planPrefs.schedule_restrictions) && planPrefs.schedule_restrictions.length) {
    out.schedule_restrictions = [...planPrefs.schedule_restrictions];
  }
  if (planPrefs.trip_budget) out.trip_budget = planPrefs.trip_budget;
  if (Array.isArray(planPrefs.stops_interests) && planPrefs.stops_interests.length) {
    out.stops_interests = [...planPrefs.stops_interests];
  }
  if (Array.isArray(planPrefs.preferences) && planPrefs.preferences.length) {
    out.preferences = [...planPrefs.preferences];
  }
  for (const key of ROUTE_SPECIFIC_PREFILL_KEYS) delete out[key];
  return out;
}

/** Prefill for the question UI — traveler profile, plan defaults, and learned trip prefs. */
export function buildFlowPrefillFromPreferences(planPrefs = {}, tripPrefs = null, travelerProfile = null) {
  const fromTraveler = travelerProfileToFlowPrefill(travelerProfile);
  const fromPlan = planPreferencesToFlowPrefill(planPrefs);
  const fromTrips = preferencesToAnswerFallback(tripPrefs);
  const out = { ...fromTraveler, ...fromTrips };
  for (const [key, val] of Object.entries(fromPlan)) {
    if (val == null || val === "") continue;
    if (Array.isArray(val)) {
      if (val.length) out[key] = val;
    } else {
      out[key] = val;
    }
  }
  for (const key of ROUTE_SPECIFIC_PREFILL_KEYS) delete out[key];
  return out;
}

const TRIP_DETAILS_PREFILL_KEYS = [
  "dietary", "accessibility", "schedule_restrictions", "stops_interests", "trip_budget",
];

/** True when the user has confirmed an answer for this question in the current flow. */
export function isQuestionConfirmedInHistory(questionId, questionHistory = []) {
  if (!questionId) return false;
  return questionHistory.some(entry => entry.question?.id === questionId);
}

function prefillValuesMatch(answerVal, prefillVal) {
  if (Array.isArray(answerVal) && Array.isArray(prefillVal)) {
    return answerVal.length === prefillVal.length
      && answerVal.every((value, index) => value === prefillVal[index]);
  }
  return answerVal === prefillVal;
}

/** Remove answer fields that only mirror unconfirmed preference prefill (stale draft / leaked state). */
export function stripUnconfirmedPrefillFromAnswers(answers = {}, flowPrefill = {}, questionHistory = []) {
  const confirmed = new Set(questionHistory.map(h => h.question?.id).filter(Boolean));
  let changed = false;
  const out = { ...answers };

  const tripDetailsConfirmed = confirmed.has("trip_details");

  for (const [key, prefillVal] of Object.entries(flowPrefill || {})) {
    if (confirmed.has(key)) continue;
    if (tripDetailsConfirmed && TRIP_DETAILS_PREFILL_KEYS.includes(key)) continue;
    const answerVal = out[key];
    if (answerVal == null || answerVal === "" || (Array.isArray(answerVal) && !answerVal.length)) continue;
    if (prefillValuesMatch(answerVal, prefillVal)) {
      delete out[key];
      changed = true;
    }
  }

  if (!tripDetailsConfirmed) {
    for (const key of TRIP_DETAILS_PREFILL_KEYS) {
      const prefillVal = flowPrefill?.[key];
      const answerVal = out[key];
      if (answerVal == null || answerVal === "" || (Array.isArray(answerVal) && !answerVal.length)) continue;
      if (prefillVal == null || prefillVal === "" || (Array.isArray(prefillVal) && !prefillVal.length)) continue;
      if (prefillValuesMatch(answerVal, prefillVal)) {
        delete out[key];
        changed = true;
      }
    }
  }

  return changed ? out : answers;
}

/** Display copy for the question UI — saved prefill is not merged here (generation uses resolveAnswersWithFallback). */
export function mergeDisplayAnswers(answers = {}, flowPrefill = {}, questionHistory = []) {
  void flowPrefill;
  void questionHistory;
  return { ...answers };
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

const INFERRED_RESTAURANT_MIN_STOP_COUNT = 3;

function getDominantRestaurantType(prefs, minCount = INFERRED_RESTAURANT_MIN_STOP_COUNT) {
  if ((Number(prefs?.trip_count) || 0) < minCount) return null;
  const entries = Object.entries(prefs?.restaurant_types || {});
  if (!entries.length) return null;
  const [type, count] = entries.sort((a, b) => b[1] - a[1])[0];
  if (count < minCount) return null;
  return type;
}

function hasExplicitRestaurantPreference(answers = {}, planPrefs = null) {
  if (answers?.restaurant_preference) return true;
  if (planPrefs?.restaurant_preference) return true;
  return false;
}

function hasDietaryRestrictions(answers = {}, planPrefs = null) {
  const fromAnswers = asArray(answers?.dietary).filter(d => d && d !== "No restrictions");
  if (fromAnswers.length) return true;
  const fromPlan = asArray(planPrefs?.dietary).filter(d => d && d !== "No restrictions");
  return fromPlan.length > 0;
}

/** Generation-time hint from stop-add learning — not written to plan_preferences. */
export function reconcileInferredRestaurantHint(prefs, answers = {}, planPrefs = null) {
  if (!prefs?.restaurant_types) return null;
  if (hasExplicitRestaurantPreference(answers, planPrefs)) return null;
  if (hasDietaryRestrictions(answers, planPrefs)) return null;
  const dominant = getDominantRestaurantType(prefs);
  if (!dominant) return null;
  return `User frequently adds ${dominant} stops on past trips.`;
}

export function resolveAnswersWithFallback(answers = {}, prefs = null, options = {}) {
  const { planPrefs = null, travelerProfile = null } = options;
  const prefill = buildFlowPrefillFromPreferences(planPrefs, prefs, travelerProfile);
  delete prefill.restaurant_preference;
  delete prefill.truck_stop_brand;
  delete prefill.fuel_brand_preference;
  const learned = preferencesToAnswerFallback(prefs);
  const {
    restaurant_preference: learnedRestaurant,
    truck_stop_brand: learnedTruckBrand,
    fuel_brand_preference: learnedFuelBrand,
    ...learnedOther
  } = learned;
  const fallback = { ...prefill, ...learnedOther };
  const merged = { ...fallback, ...answers };

  if (!merged.vehicle && fallback.vehicle) merged.vehicle = fallback.vehicle;
  if (!merged.effective_vehicle) merged.effective_vehicle = getEffectiveVehicle(merged);

  if (!merged.fuel_type && fallback.fuel_type) merged.fuel_type = fallback.fuel_type;
  if (!merged.travelers && fallback.travelers) merged.travelers = fallback.travelers;

  if (!merged.stops_interests?.length && fallback.stops_interests) {
    merged.stops_interests = fallback.stops_interests;
  }
  if (!merged.lodging && fallback.lodging) merged.lodging = fallback.lodging;
  if (!merged.preferences?.length && fallback.preferences) merged.preferences = fallback.preferences;
  if (!merged.dietary?.length && fallback.dietary) merged.dietary = fallback.dietary;
  if (!merged.accessibility?.length && fallback.accessibility) merged.accessibility = fallback.accessibility;
  if (!merged.schedule_restrictions?.length && fallback.schedule_restrictions) {
    merged.schedule_restrictions = fallback.schedule_restrictions;
  }
  if (!merged.trip_budget && fallback.trip_budget) merged.trip_budget = fallback.trip_budget;

  const inferredRestaurantHint = reconcileInferredRestaurantHint(prefs, answers, planPrefs);
  if (inferredRestaurantHint) {
    merged.inferredRestaurantHint = inferredRestaurantHint;
  } else if (
    learnedRestaurant
    && !merged.restaurant_preference
    && !hasDietaryRestrictions(merged, planPrefs)
    && !answers.restaurant_preference
  ) {
    merged.restaurant_preference = learnedRestaurant;
  }

  if (hasDietaryRestrictions(merged, planPrefs)) {
    delete merged.restaurant_preference;
  }

  const hasTruckStopBrand = merged.truck_stop_brand && merged.truck_stop_brand !== "No preference";
  if (!hasTruckStopBrand && learnedTruckBrand) {
    merged.truck_stop_brand = learnedTruckBrand;
    merged.fuel_brand_preference = learnedFuelBrand || learnedTruckBrand;
  } else if (!merged.fuel_brand_preference && learnedFuelBrand) {
    merged.fuel_brand_preference = learnedFuelBrand;
  }

  return merged;
}

/** Remove contradictory fields before sending answers to Sonnet. */
export function stripAnswersForSonnet(answers = {}) {
  const out = { ...answers };
  if (hasDietaryRestrictions(out)) {
    delete out.restaurant_preference;
  }
  return out;
}

export function detectAnswerGaps(answers = {}) {
  const gaps = [];
  if (!answers.vehicle) gaps.push("vehicle");
  if (!answers.trip_type) gaps.push("trip_type");
  if (!answers.stops_interests?.length && !answers.preferences?.length) gaps.push("stop_preferences");
  return gaps;
}

export function formatGracefulDegradationNotes(answers, prefs, gaps = [], savedTripsCount = null) {
  const hasRouteDegrade = Boolean(answers?.route_context_unavailable);
  const thinTripHistory = savedTripsCount != null && savedTripsCount < 3;
  if (!hasRouteDegrade && !gaps.length && !prefs && !thinTripHistory) return "";
  const lines = ["=== GRACEFUL DEGRADATION (proceed with best available context) ==="];
  if (hasRouteDegrade) {
    lines.push("Route distance/duration was unavailable when the user confirmed overnight preferences. Do not rely on precise corridor timing — use origin, destination, and stated preferences.");
  }
  if (gaps.length) {
    lines.push(`Missing or incomplete answers: ${gaps.join(", ")}. Use saved user preferences and route context as fallback — do not fail or return a generic trip.`);
  }
  if (prefs?.trip_count > 0) {
    lines.push("Saved user preference history is available — prioritize it over generic defaults for any missing fields.");
  }
  if (thinTripHistory) {
    lines.push("No trip history yet — do not infer travel patterns from stop-category data alone.");
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
