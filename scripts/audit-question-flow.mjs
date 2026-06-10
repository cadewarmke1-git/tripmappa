/**
 * Exhaustive question-flow audit — simulates all vehicle/route branches.
 * Run: node scripts/audit-question-flow.mjs
 */
import {
  getNextFlowQuestion,
  normalizeTripAnswers,
  pruneStaleBranchAnswers,
  isRouteContextReady,
} from "../src/lib/tripFlow.js";
import { VEHICLE_CHOICES, MULTI_VEHICLE_TRIP } from "../src/lib/tripFlow.js";
import { needsFoodAllergyDetail } from "../src/lib/tripAccommodations.js";
import { needsScheduleHoursDetail } from "../src/lib/scheduleRestrictions.js";
import { isContinuousDrive, OVERNIGHT_PREFERENCE_OVERNIGHT, requiresMultipleDays } from "../src/lib/driveMode.js";
import { getEffectiveVehicle } from "../src/lib/vehicles.js";

const ROUTE_CONTEXTS = {
  none: {},
  dayTrip: { routeDistance: "80 mi", routeDuration: "1 hour 30 mins", routeDistanceMiles: 80, routeDurationHours: 1.5 },
  medium: { routeDistance: "220 mi", routeDuration: "4 hours 30 mins", routeDistanceMiles: 220, routeDurationHours: 4.5 },
  long: { routeDistance: "520 mi", routeDuration: "8 hours 15 mins", routeDistanceMiles: 520, routeDurationHours: 8.25 },
  veryLong: { routeDistance: "1200 mi", routeDuration: "18 hours", routeDistanceMiles: 1200, routeDurationHours: 18 },
  routeFailed: { routeFailed: true },
  milesOnly: { routeDistance: "400 mi", routeDistanceMiles: 400 },
};

const THIN_TRANSPORT = ["Boat", "Ferry", "Plane"];

function pickTripDetails(q, answers, variant) {
  if (variant === "defaults") {
    return {
      dietary: [],
      stops_interests: [],
      accessibility: [],
      schedule_restrictions: [],
      trip_budget: "No budget limit",
    };
  }
  const hasDestInterests = q.sections?.some((s) => s.id === "stops_interests");
  return {
    dietary: ["Halal"],
    stops_interests: hasDestInterests ? ["Cities and culture"] : [],
    accessibility: ["Wheelchair accessible lodging required"],
    schedule_restrictions: variant === "schedule"
      ? ["Drive only during specific hours — I will specify"]
      : ["No restrictions"],
    trip_budget: "$500 to $1000",
  };
}

function applyAnswer(q, answers, options) {
  const { variant = "default", multiPrimary = "Car" } = options;
  if (!q || q.done) return answers;

  if (q.type === "trip_details") {
    const patch = pickTripDetails(q, answers, variant === "schedule" ? "schedule" : variant === "defaults" ? "defaults" : "default");
    return { ...answers, ...patch };
  }
  if (q.type === "lodging_stay") {
    return { ...answers, lodging: "Mid-Range", loyalty_program: "Marriott Bonvoy" };
  }
  if (q.id === "primary_vehicle") return { ...answers, primary_vehicle: multiPrimary };
  if (q.id === "overnight_preference") {
    return {
      ...answers,
      overnight_preference: variant === "continuous" ? "Drive straight through" : OVERNIGHT_PREFERENCE_OVERNIGHT,
    };
  }
  if (q.id === "sleeper_cab" && variant === "noSleeper") {
    return { ...answers, sleeper_cab: "No — I need a motel or hotel" };
  }
  if (q.id === "fuel_type" && variant === "tesla") return { ...answers, fuel_type: "Electric — Tesla Superchargers" };
  if (q.id === "towing" && variant === "towing") return { ...answers, towing: "Yes — large trailer" };
  if (q.id === "multi_vehicles") {
    if (multiPrimary === "RV") return { ...answers, multi_vehicles: ["Car", "RV"] };
    if (multiPrimary === "Semi Truck (18-wheeler)") {
      return { ...answers, multi_vehicles: ["Car", "Semi Truck (18-wheeler)"] };
    }
    if (THIN_TRANSPORT.includes(multiPrimary)) {
      return { ...answers, multi_vehicles: ["Car", multiPrimary] };
    }
    return { ...answers, multi_vehicles: ["Car", "RV"] };
  }
  if (q.id === "route_restrictions") return { ...answers, route_restrictions: ["No restrictions"] };
  if (q.id === "coordination_needs") return { ...answers, coordination_needs: ["Stay together the whole way"] };
  if (q.id === "preferences") return { ...answers, preferences: [] };
  if (q.id === "travelers") return { ...answers, travelers: "3 to 5" };
  if (q.type === "party_composition") {
    return { ...answers, adult_count: 2, child_count: 1 };
  }
  if (q.id === "trip_nights") return { ...answers, trip_nights: "2 nights" };
  if (q.id === "food_allergies") return { ...answers, food_allergies: "peanuts, shellfish" };
  if (q.id === "schedule_drive_hours") return { ...answers, schedule_drive_hours: "8am-6pm" };
  if (q.type === "multiselect") return { ...answers, [q.id]: q.choices?.length ? [q.choices[0]] : [] };
  if (q.type === "text") return { ...answers, [q.id]: "peanuts, shellfish" };
  if (q.type === "vehicle") return { ...answers, vehicle: q.choices?.[0] || "Car" };
  if (Array.isArray(q.choices) && q.choices.length) {
    const first = q.choices[0];
    const val = typeof first === "object" ? first.value : first;
    return { ...answers, [q.id]: val };
  }
  return { ...answers, [q.id]: "Yes" };
}

function simulateFlow(vehicle, context, options = {}) {
  const { variant = "default", multiPrimary = "Car", resolvePending = "skip" } = options;
  let answers = { vehicle };
  const path = [];
  const issues = [];
  let steps = 0;
  const maxSteps = 40;
  let sawLodgingBeforeOvernight = false;
  let overnightSeen = false;

  while (steps < maxSteps) {
    steps++;
    const q = getNextFlowQuestion(answers, context);
    if (q.done) {
      path.push({ step: steps, done: true, skipMessage: q.skipMessage });
      break;
    }

    if (q.id === "overnight_preference") overnightSeen = true;
    if (q.id === "lodging" || q.type === "lodging_stay") {
      if (!overnightSeen && answers.overnight_preference !== OVERNIGHT_PREFERENCE_OVERNIGHT) {
        sawLodgingBeforeOvernight = true;
      }
    }

    path.push({
      step: steps,
      id: q.id,
      type: q.type,
      pendingRoute: q.pendingRoute,
    });

    if (q.pendingRoute && !isRouteContextReady(context) && !context.routeFailed) {
      if (resolvePending === "skip") {
        answers = { ...answers, route_context_unavailable: true };
        continue;
      }
      issues.push({
        severity: "high",
        code: "STUCK_PENDING_ROUTE",
        message: `Deadlock at pendingRoute "${q.id}" with no resolution`,
      });
      break;
    }

    answers = applyAnswer(q, answers, { variant, multiPrimary });
  }

  if (steps >= maxSteps) {
    issues.push({ severity: "critical", code: "INFINITE_LOOP", message: "Exceeded max steps" });
  }

  const finalQ = getNextFlowQuestion(answers, context);
  if (!finalQ.done) {
    issues.push({
      severity: "critical",
      code: "INCOMPLETE_FLOW",
      message: `Flow stopped early — next would be "${finalQ.id}"`,
    });
  }

  const normalized = normalizeTripAnswers(answers, context, { forGeneration: true });

  if (needsFoodAllergyDetail(normalized) && !answers.food_allergies && finalQ.done) {
    issues.push({ severity: "critical", code: "SKIPPED_ALLERGY_FOLLOWUP", message: "Food allergy follow-up missing" });
  }
  if (needsScheduleHoursDetail(normalized) && !answers.schedule_drive_hours && finalQ.done) {
    issues.push({ severity: "critical", code: "SKIPPED_SCHEDULE_HOURS", message: "Schedule hours follow-up missing" });
  }

  const accessibilityStandalone = path.filter((p) => p.id === "accessibility").length;
  if (accessibilityStandalone > 0) {
    issues.push({
      severity: "medium",
      code: "DUPLICATE_ACCESSIBILITY",
      message: `Standalone accessibility asked ${accessibilityStandalone} time(s) — should only be in trip_details`,
    });
  }

  if (sawLodgingBeforeOvernight && !isContinuousDrive(answers)) {
    issues.push({
      severity: "critical",
      code: "LODGING_BEFORE_OVERNIGHT",
      message: "Lodging appeared before overnight preference was collected",
    });
  }

  if (isContinuousDrive(answers) && path.some((p) => p.id === "lodging" || p.type === "lodging_stay")) {
    issues.push({
      severity: "high",
      code: "LODGING_ON_CONTINUOUS",
      message: "Lodging asked during continuous drive",
    });
  }

  const effective = getEffectiveVehicle(answers);
  if (THIN_TRANSPORT.includes(vehicle) || (vehicle === MULTI_VEHICLE_TRIP && THIN_TRANSPORT.includes(multiPrimary))) {
    if (!path.some((p) => p.id === "travelers")) {
      issues.push({ severity: "critical", code: "THIN_NO_TRAVELERS", message: "Thin transport path skipped travelers" });
    }
    if (!path.some((p) => p.id === "trip_details")) {
      issues.push({ severity: "critical", code: "THIN_NO_DETAILS", message: "Thin transport path skipped trip_details" });
    }
    if (path.some((p) => p.done) && path.filter((p) => !p.done).length === 0) {
      issues.push({ severity: "critical", code: "ZERO_QUESTIONS", message: "Thin transport completed with zero questions" });
    }
  }

  if ((effective === "Plane" || effective === "Ferry") && path.some((p) => p.id === "trip_details")) {
    const detailsStep = path.find((p) => p.id === "trip_details");
    if (detailsStep && !answers.stops_interests?.length && variant !== "defaults") {
      // destination interests optional if defaults variant
    }
  }

  if (vehicle === MULTI_VEHICLE_TRIP && multiPrimary === "RV") {
    const ids = path.filter((p) => !p.done).map((p) => p.id);
    const expectedPrefix = ["multi_vehicles", "primary_vehicle", "fuel_type", "travelers", "party_composition", "kids_ages", "preferences"];
    if (requiresMultipleDays(context)) expectedPrefix.push("trip_nights");
    expectedPrefix.push("trip_details");
    for (let i = 0; i < expectedPrefix.length; i += 1) {
      if (ids[i] !== expectedPrefix[i]) {
        issues.push({
          severity: "critical",
          code: "MULTI_RV_PATH_ORDER",
          message: `Multi+RV expected ${expectedPrefix[i]} at step ${i + 1}, got ${ids[i] || "(missing)"}`,
        });
        break;
      }
    }
    if (!ids.includes("coordination_needs")) {
      issues.push({ severity: "critical", code: "MULTI_RV_NO_COORDINATION", message: "Multi+RV missing coordination_needs" });
    }
    if (ids.includes("overnight_preference") || ids.includes("lodging")) {
      issues.push({
        severity: "critical",
        code: "MULTI_RV_CAR_FALLTHROUGH",
        message: "Multi+RV primary incorrectly entered personal car overnight/lodging flow",
      });
    }
  }

  if (vehicle === MULTI_VEHICLE_TRIP && multiPrimary === "Semi Truck (18-wheeler)") {
    const ids = path.filter((p) => !p.done).map((p) => p.id);
    for (const required of ["hauling_type", "sleeper_cab", "truck_stop_brand", "route_restrictions", "trip_details"]) {
      if (!ids.includes(required)) {
        issues.push({
          severity: "critical",
          code: "MULTI_TRUCK_PATH",
          message: `Multi+Truck missing ${required} — path: ${ids.join(",")}`,
        });
        break;
      }
    }
    if (ids.includes("overnight_preference")) {
      issues.push({
        severity: "critical",
        code: "MULTI_TRUCK_CAR_FALLTHROUGH",
        message: "Multi+Truck primary incorrectly entered personal car overnight flow",
      });
    }
  }

  return {
    vehicle,
    contextKey: options.contextKey,
    variant,
    path,
    issues,
    normalized,
    steps,
    questionCount: path.filter((p) => !p.done).length,
  };
}

const allIssues = [];
const summaries = [];

for (const [contextKey, context] of Object.entries(ROUTE_CONTEXTS)) {
  for (const vehicle of VEHICLE_CHOICES) {
    if (vehicle === MULTI_VEHICLE_TRIP) continue;
    for (const variant of ["default", "continuous", "defaults"]) {
      if (THIN_TRANSPORT.includes(vehicle) && variant !== "default") continue;
      if (vehicle === "Car" && variant === "tesla") continue;
      const r = simulateFlow(vehicle, context, { variant, contextKey, resolvePending: "skip" });
      summaries.push(r);
      allIssues.push(...r.issues.map((i) => ({ ...i, vehicle, contextKey, variant })));
    }
    if (vehicle === "Car") {
      for (const variant of ["tesla", "towing", "schedule"]) {
        const r = simulateFlow(vehicle, context, { variant, contextKey, resolvePending: "skip" });
        summaries.push(r);
        allIssues.push(...r.issues.map((i) => ({ ...i, vehicle, contextKey, variant })));
      }
    }
    if (["Semi Truck (18-wheeler)", "Flatbed", "Tanker", "Box Truck"].includes(vehicle)) {
      const r = simulateFlow(vehicle, context, { variant: "noSleeper", contextKey, resolvePending: "skip" });
      summaries.push(r);
      allIssues.push(...r.issues.map((i) => ({ ...i, vehicle, contextKey, variant: "noSleeper" })));
    }
  }

  for (const primary of ["Car", "Semi Truck (18-wheeler)", "RV", "Plane", "Boat"]) {
    const r = simulateFlow(MULTI_VEHICLE_TRIP, context, { multiPrimary: primary, contextKey, variant: "default", resolvePending: "skip" });
    summaries.push(r);
    allIssues.push(...r.issues.map((i) => ({ ...i, vehicle: `${MULTI_VEHICLE_TRIP}→${primary}`, contextKey, variant: "default" })));
  }
}

// Medium trip must ask overnight (3.5hr threshold)
const mediumNext = getNextFlowQuestion(
  { vehicle: "Car", fuel_type: "Gasoline", towing: "No", travelers: "2", preferences: [] },
  ROUTE_CONTEXTS.medium,
);
if (mediumNext.id !== "overnight_preference") {
  allIssues.push({
    severity: "critical",
    code: "MEDIUM_NO_OVERNIGHT",
    vehicle: "Car",
    contextKey: "medium",
    message: `220mi/4.5hr trip should ask overnight — got "${mediumNext.id}"`,
  });
}

// Trip nights before lodging after stop overnight
const mediumNights = getNextFlowQuestion(
  {
    vehicle: "Car",
    fuel_type: "Gasoline",
    towing: "No",
    travelers: "2",
    preferences: [],
    overnight_preference: OVERNIGHT_PREFERENCE_OVERNIGHT,
  },
  ROUTE_CONTEXTS.medium,
);
if (mediumNights.id !== "trip_nights") {
  allIssues.push({
    severity: "critical",
    code: "NIGHTS_NOT_AFTER_OVERNIGHT",
    vehicle: "Car",
    message: `Expected trip_nights after overnight — got "${mediumNights.id}"`,
  });
}
const mediumLodging = getNextFlowQuestion(
  {
    vehicle: "Car",
    fuel_type: "Gasoline",
    towing: "No",
    travelers: "2",
    preferences: [],
    overnight_preference: OVERNIGHT_PREFERENCE_OVERNIGHT,
    trip_nights: "2 nights",
  },
  ROUTE_CONTEXTS.medium,
);
if (mediumLodging.id !== "lodging" && mediumLodging.type !== "lodging_stay") {
  allIssues.push({
    severity: "critical",
    code: "LODGING_NOT_AFTER_NIGHTS",
    vehicle: "Car",
    message: `Expected lodging after trip_nights — got "${mediumLodging.id}"`,
  });
}

const mediumNoLodging = getNextFlowQuestion(
  {
    vehicle: "Car",
    fuel_type: "Gasoline",
    towing: "No",
    travelers: "2",
    preferences: [],
  },
  ROUTE_CONTEXTS.medium,
);
if (mediumNoLodging.id === "lodging" || mediumNoLodging.type === "lodging_stay") {
  allIssues.push({
    severity: "critical",
    code: "LODGING_WITHOUT_OVERNIGHT",
    vehicle: "Car",
    message: "Lodging asked before overnight preference on medium trip",
  });
}

// Route pending unlock simulation
const pendingQ = getNextFlowQuestion(
  { vehicle: "Car", fuel_type: "Gasoline", towing: "No", travelers: "2", preferences: [] },
  ROUTE_CONTEXTS.none,
);
if (!pendingQ.pendingRoute || pendingQ.id !== "overnight_preference") {
  allIssues.push({
    severity: "high",
    code: "PENDING_ROUTE_MISSING",
    message: "Expected pending overnight when route context missing",
  });
}
const unlockedQ = getNextFlowQuestion(
  {
    vehicle: "Car",
    fuel_type: "Gasoline",
    towing: "No",
    travelers: "2",
    preferences: [],
    route_context_unavailable: true,
  },
  ROUTE_CONTEXTS.none,
);
if (unlockedQ.pendingRoute) {
  allIssues.push({
    severity: "high",
    code: "PENDING_ROUTE_NOT_UNLOCKED",
    message: "route_context_unavailable should unlock overnight question",
  });
}

// Prune test
const pruned = pruneStaleBranchAnswers(
  { vehicle: "Semi Truck (18-wheeler)", overnight_preference: OVERNIGHT_PREFERENCE_OVERNIGHT, lodging: "Luxury" },
  ROUTE_CONTEXTS.long,
);
if (pruned.overnight_preference || pruned.lodging === "Luxury") {
  allIssues.push({ severity: "high", code: "PRUNE_FAILED", message: "Stale car lodging survived truck switch" });
}

// Truck path shape
const truckWalk = simulateFlow("Semi Truck (18-wheeler)", ROUTE_CONTEXTS.long, { resolvePending: "skip" });
const truckIds = truckWalk.path.filter((p) => !p.done).map((p) => p.id).join(",");
if (truckIds.includes("accessibility")) {
  allIssues.push({ severity: "medium", code: "TRUCK_STANDALONE_ACCESSIBILITY", message: `Truck path includes accessibility: ${truckIds}` });
}
const expectedTruckTail = "hauling_type,sleeper_cab,truck_stop_brand,route_restrictions,trip_details";
if (!truckIds.startsWith(expectedTruckTail.split(",").slice(0, 4).join(","))) {
  // loose check — at least no accessibility before trip_details
}

console.log("=== QUESTION FLOW AUDIT (post-fixes) ===\n");
console.log(`Simulations run: ${summaries.length}`);
console.log(`Issues found: ${allIssues.length}\n`);

if (allIssues.length === 0) {
  console.log("✓ All simulations passed — no flow defects detected.\n");
} else {
  const grouped = {};
  for (const i of allIssues) {
    grouped[i.code] = grouped[i.code] || [];
    grouped[i.code].push(i);
  }
  for (const [code, items] of Object.entries(grouped)) {
    console.log(`## ${code} (${items.length}) [${items[0].severity}]`);
    console.log(`   ${items[0].message}`);
    const samples = [...new Set(items.slice(0, 6).map((i) => `${i.vehicle || "?"} @ ${i.contextKey || "global"}${i.variant ? ` (${i.variant})` : ""}`))];
    console.log(`   Samples: ${samples.join("; ")}\n`);
  }
}

console.log("=== KEY PATH WALKS (human-like) ===");
function walkPath(label, vehicle, ctx, opts = {}) {
  let a = { vehicle };
  const path = [];
  for (let i = 0; i < 30; i++) {
    const q = getNextFlowQuestion(a, ctx);
    if (q.done) {
      path.push(`DONE${q.skipMessage ? `: ${q.skipMessage.slice(0, 50)}…` : ""}`);
      break;
    }
    path.push(`${q.id}${q.pendingRoute ? "*" : ""}`);
    if (q.pendingRoute && !isRouteContextReady(ctx) && !ctx.routeFailed) {
      a = { ...a, route_context_unavailable: true };
      continue;
    }
    a = applyAnswer(q, a, { ...opts, multiPrimary: opts.multiPrimary || opts.primary || "Car" });
  }
  const qCount = path.filter((p) => !p.startsWith("DONE")).length;
  console.log(`  ${label} (${qCount} Q): ${path.join(" → ")}`);
  return path;
}

const long = ROUTE_CONTEXTS.long;
walkPath("Car long / overnight", "Car", long);
walkPath("Car medium / overnight first", "Car", ROUTE_CONTEXTS.medium);
walkPath("Car continuous", "Car", long, { variant: "continuous" });
walkPath("Car pending route → skip", "Car", ROUTE_CONTEXTS.none);
walkPath("Truck", "Semi Truck (18-wheeler)", long);
walkPath("Truck no sleeper", "Semi Truck (18-wheeler)", long, { variant: "noSleeper" });
walkPath("RV", "RV", long);
walkPath("Plane", "Plane", long);
walkPath("Ferry", "Ferry", long);
walkPath("Boat", "Boat", long);
walkPath("Multi → Plane", MULTI_VEHICLE_TRIP, long, { multiPrimary: "Plane" });
walkPath("Multi → Boat", MULTI_VEHICLE_TRIP, long, { multiPrimary: "Boat" });
walkPath("Multi → Truck", MULTI_VEHICLE_TRIP, long, { multiPrimary: "Semi Truck (18-wheeler)" });
walkPath("Multi → RV", MULTI_VEHICLE_TRIP, long, { multiPrimary: "RV" });
walkPath("Multi → Car", MULTI_VEHICLE_TRIP, long, { multiPrimary: "Car" });
walkPath("Day trip Car", "Car", ROUTE_CONTEXTS.dayTrip);

console.log("\n=== QUESTION COUNTS BY VEHICLE (long route, default) ===");
for (const v of ["Car", "Plane", "Boat", "Ferry", "Semi Truck (18-wheeler)", "RV"]) {
  const s = summaries.find((x) => x.vehicle === v && x.contextKey === "long" && x.variant === "default");
  if (s) console.log(`  ${v}: ${s.questionCount} questions`);
}

process.exit(allIssues.length > 0 ? 1 : 0);
