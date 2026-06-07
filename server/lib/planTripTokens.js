/** Dynamic max_tokens tiers from trip complexity (schema analysis). */

const TRIP_NIGHTS_RE = /(\d+)/;

function parseTripNights(tripNights) {
  if (!tripNights) return 0;
  const m = String(tripNights).match(TRIP_NIGHTS_RE);
  return m ? parseInt(m[1], 10) : 0;
}

function countActiveDietary(dietary) {
  return (Array.isArray(dietary) ? dietary : []).filter(d => d && d !== "No restrictions").length;
}

function hasComplexityStacking(ctx, answers) {
  const childCount = Number(answers?.child_count) || 0;
  const prefs = Array.isArray(answers?.preferences) ? answers.preferences : [];
  return (
    childCount > 0
    || prefs.includes("Pet friendly")
    || countActiveDietary(answers?.dietary) >= 2
    || ctx.tripCategory === "commercial"
    || ctx.tripCategory === "rv"
  );
}

function resolveOvernightCount(answers, routeMiles) {
  const fromNights = parseTripNights(answers?.trip_nights);
  if (fromNights > 0) return fromNights;
  if (routeMiles >= 800) return 2;
  if (routeMiles >= 400) return 1;
  if (routeMiles >= 150) return 1;
  return 0;
}

function resolveRouteMiles(ctx, routeInfo) {
  if (routeInfo?.routeDistanceMiles != null && !Number.isNaN(Number(routeInfo.routeDistanceMiles))) {
    return Number(routeInfo.routeDistanceMiles);
  }
  if (ctx?.routeMiles > 0) return ctx.routeMiles;
  return 0;
}

/**
 * @returns {{ maxTokens: number, tier: string }}
 */
export function calculateMaxTokens(ctx, answers = {}, routeInfo = {}, isSimplifiedFormat = false) {
  const miles = resolveRouteMiles(ctx, routeInfo);
  const tripType = answers?.trip_type || ctx?.tripType || "Road trip";

  if (ctx.tripCategory === "plane" || ctx.tripCategory === "water") {
    return { maxTokens: 2048, tier: "plane_water_simplified" };
  }

  if (isSimplifiedFormat) {
    if (["Day trip", "Driving home"].includes(tripType) || (miles > 0 && miles < 150)) {
      return { maxTokens: 2048, tier: "day_under_150_simplified" };
    }
    if (miles >= 150 && miles <= 400) {
      return { maxTokens: 2048, tier: "medium_150_400_no_overnight" };
    }
    return { maxTokens: 2048, tier: "simplified_default" };
  }

  const overnights = resolveOvernightCount(answers, miles);

  if (miles > 800 && overnights >= 2) {
    if (hasComplexityStacking(ctx, answers)) {
      return { maxTokens: 5120, tier: "very_long_800plus_stacked" };
    }
    return { maxTokens: 4096, tier: "very_long_800plus_baseline" };
  }

  if (miles > 800) {
    if (hasComplexityStacking(ctx, answers)) {
      return { maxTokens: 5120, tier: "very_long_800plus_stacked" };
    }
    return { maxTokens: 4096, tier: "very_long_800plus_baseline" };
  }

  if (miles >= 400 && miles <= 800) {
    return { maxTokens: 4096, tier: "long_400_800" };
  }

  if (overnights === 1 || (miles >= 150 && miles < 400)) {
    return { maxTokens: 3072, tier: "medium_1_overnight" };
  }

  return { maxTokens: 3072, tier: "multi_day_default" };
}
