/** Shared trip-history analysis for client and server — patterns, rollups, utilities. */
import { asArray, TRIP_BUDGET_CHOICES } from "./tripAccommodations.js";
import { getScheduleRestrictionLabels } from "./scheduleRestrictions.js";

const PATTERN_WINDOW = 5;

// Pattern confidence thresholds (of last PATTERN_WINDOW trips, minimum 3 trips required to emit any pattern):
// - Behavioral habits (scenic, pet-friendly, schedule): 3/5 — habit-forming preferences worth surfacing early.
// - Constraint-based prefs (budget, lodging, vehicle): 4/5 — wrong inference hurts trip quality more; require higher confidence.
// - Dietary: 3/5 exception — health/safety concern; surface as soon as a consistent signal exists (aligned with rollup at 3/3).
const BEHAVIORAL_PATTERN_MIN = 3;
const CONSTRAINT_PATTERN_MIN = 4;
const DIETARY_PATTERN_MIN = 3;

/** Read trip list from a ref (sync) or plain array — refs win for back-to-back generation races. */
export function resolveTripsForContext(tripsOrRef) {
  if (tripsOrRef && typeof tripsOrRef === "object" && "current" in tripsOrRef) {
    return tripsOrRef.current ?? [];
  }
  return tripsOrRef ?? [];
}

function summarizeDietary(answers = {}) {
  return asArray(answers.dietary).filter(d => d && d !== "No restrictions");
}

function tripHasPetFriendly(answers = {}) {
  return asArray(answers.preferences).includes("Pet friendly");
}

function dietarySignature(answers = {}) {
  const items = summarizeDietary(answers);
  return items.length ? items.slice().sort().join("|") : "";
}

function scheduleSignature(answers = {}) {
  const items = getScheduleRestrictionLabels(answers);
  return items.length ? items.slice().sort().join("|") : "";
}

function budgetTierIndex(budget) {
  const idx = TRIP_BUDGET_CHOICES.indexOf(budget);
  return idx >= 0 ? idx : null;
}

function isBudgetWithinOneTier(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const ia = budgetTierIndex(a);
  const ib = budgetTierIndex(b);
  if (ia == null || ib == null) return false;
  return Math.abs(ia - ib) <= 1;
}

function mostCommon(values = []) {
  const counts = new Map();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return bestCount > 0 ? { value: best, count: bestCount } : null;
}

/** Roll up dietary, lodging, budget, and pet signals from recent trips for the server preferences block. */
export function buildRecentTripsPreferencesRollup(tripsOrRef = [], limit = 3) {
  const recent = resolveTripsForContext(tripsOrRef).slice(0, limit);
  if (!recent.length) return "";

  const lines = [
    "=== RECENT TRIP PREFERENCE SIGNALS (from saved trips — align suggestions with this history) ===",
  ];

  const petCount = recent.filter(t => tripHasPetFriendly(t.answers || {})).length;
  if (petCount > 0) {
    lines.push(`Pet-friendly trips: ${petCount} of last ${recent.length}`);
  }

  const diets = recent.map(t => dietarySignature(t.answers || {})).filter(Boolean);
  const topDiet = mostCommon(diets);
  if (topDiet && topDiet.count >= 2) {
    lines.push(`Common dietary pattern: ${topDiet.value.split("|").join(", ")} (${topDiet.count}/${recent.length} trips)`);
  }

  const budgets = recent
    .map(t => t.answers?.trip_budget)
    .filter(b => b && b !== "No budget limit");
  const topBudget = mostCommon(budgets);
  if (topBudget && topBudget.count >= 2) {
    lines.push(`Typical budget tier: ${topBudget.value} (${topBudget.count}/${recent.length} trips)`);
  }

  const lodgings = recent.map(t => t.answers?.lodging).filter(Boolean);
  const topLodging = mostCommon(lodgings);
  if (topLodging && topLodging.count >= 2) {
    lines.push(`Typical lodging tier: ${topLodging.value} (${topLodging.count}/${recent.length} trips)`);
  }

  const scenicCount = recent.filter(t => asArray(t.answers?.preferences).includes("Scenic route")).length;
  if (scenicCount >= 2) {
    lines.push(`Scenic route selected: ${scenicCount}/${recent.length} recent trips`);
  }

  if (lines.length <= 1) return "";
  return lines.join("\n");
}

export function buildUserPatternSummary(tripsOrRef = []) {
  const recent = resolveTripsForContext(tripsOrRef).slice(0, PATTERN_WINDOW);
  if (recent.length < 3) return "";

  const patterns = [];

  const scenicCount = recent.filter(t => asArray(t.answers?.preferences).includes("Scenic route")).length;
  if (scenicCount >= BEHAVIORAL_PATTERN_MIN) {
    patterns.push(
      scenicCount >= recent.length
        ? "Always prefers scenic routes"
        : "Almost always prefers scenic routes",
    );
  }

  const petCount = recent.filter(t => tripHasPetFriendly(t.answers || {})).length;
  if (petCount >= BEHAVIORAL_PATTERN_MIN) {
    patterns.push(
      petCount >= recent.length - 1
        ? "Consistently travels pet-friendly"
        : "Usually travels pet-friendly",
    );
  }

  const lodgings = recent.map(t => t.answers?.lodging).filter(Boolean);
  const topLodging = mostCommon(lodgings);
  if (topLodging) {
    const lodgingMatches = recent.filter(t => t.answers?.lodging === topLodging.value).length;
    if (lodgingMatches >= CONSTRAINT_PATTERN_MIN) {
      patterns.push(`Typically stays at ${topLodging.value.toLowerCase()} lodging`);
    }
  }

  const budgets = recent
    .map(t => t.answers?.trip_budget)
    .filter(b => b && b !== "No budget limit");
  const topBudget = mostCommon(budgets);
  if (topBudget) {
    const withinTier = recent.filter(t => {
      const b = t.answers?.trip_budget;
      return b && b !== "No budget limit" && isBudgetWithinOneTier(b, topBudget.value);
    }).length;
    if (withinTier >= CONSTRAINT_PATTERN_MIN) {
      patterns.push(`Consistent budget range around ${topBudget.value}`);
    }
  }

  const diets = recent.map(t => dietarySignature(t.answers || {})).filter(Boolean);
  const topDiet = mostCommon(diets);
  // Dietary at 3/5: health/safety — unlike budget/lodging, do not wait for 4/5 (rollup already flags at 3/3).
  if (topDiet && topDiet.count >= DIETARY_PATTERN_MIN) {
    patterns.push(`Consistent dietary restriction: ${topDiet.value.split("|").join(", ")}`);
  }

  const vehicles = recent.map(t => t.answers?.vehicle || t.routeInfo?.vehicleType).filter(Boolean);
  const topVehicle = mostCommon(vehicles);
  if (topVehicle && topVehicle.count >= CONSTRAINT_PATTERN_MIN) {
    patterns.push(`Consistent vehicle type: ${topVehicle.value}`);
  }

  const schedules = recent.map(t => scheduleSignature(t.answers || {})).filter(Boolean);
  const topSchedule = mostCommon(schedules);
  if (topSchedule && topSchedule.count >= BEHAVIORAL_PATTERN_MIN) {
    patterns.push(`Consistent schedule pattern: ${topSchedule.value.split("|").join(", ")}`);
  }

  if (!patterns.length) return "";

  return [
    "=== USER TRAVEL PATTERNS (inferred from trip history) ===",
    ...patterns,
    "Current trip answers take priority over these patterns where they differ.",
  ].join("\n");
}
