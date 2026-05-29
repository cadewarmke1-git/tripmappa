import {
  isTruckVehicle,
  isRvVehicle,
  isWaterVehicle,
  applyAssumedVehicleSpecs,
  getEffectiveVehicle,
  MULTI_VEHICLE_TRIP,
} from "./vehicles.js";
import { parseMilesFromDistance, parseHoursFromDuration } from "./parsing.js";
import {
  isContinuousDrive,
  OVERNIGHT_PREFERENCE_CONTINUOUS,
  OVERNIGHT_PREFERENCE_OVERNIGHT,
  requiresMultipleDays,
} from "./driveMode.js";
import {
  isPersonalVehicle,
  FUEL_TYPE_CHOICES,
  TOWING_CHOICES,
  DIETARY_CHOICES,
  ACCESSIBILITY_CHOICES,
  TRIP_BUDGET_CHOICES,
  LOYALTY_CHOICES,
  getStopsInterestsChoices,
  needsFoodAllergyDetail,
  needsTowingQuestion,
  isTowingSelected,
} from "./tripAccommodations.js";

export { MULTI_VEHICLE_TRIP };

export const MARINE_SKIP_MESSAGE =
  "Marine routing is approximate — Google Maps does not support water navigation. Showing departure and arrival port recommendations only.";
export const PLANE_SKIP_MESSAGE =
  "Showing airport transport, layover recommendations, and destination activity suggestions only.";

export { isContinuousDrive, requiresMultipleDays } from "./driveMode.js";

export const FLOW_QUESTION_IDS = [
  "vehicle", "fuel_type", "towing", "multi_vehicles", "primary_vehicle", "travelers",
  "overnight_preference", "lodging", "loyalty_program", "dietary", "food_allergies", "accessibility",
  "stops_interests", "trip_budget", "preferences",
  "hauling_type", "sleeper_cab", "truck_stop_brand", "route_restrictions", "coordination_needs",
];

export const VEHICLE_GROUPS = [
  {
    label: "Personal",
    options: [
      { value: "Car", label: "Car" },
      { value: "Motorcycle", label: "Motorcycle" },
      { value: "SUV or Van", label: "SUV or Van" },
      { value: "Rental Car", label: "Rental Car — check mileage limits on your agreement" },
    ],
  },
  {
    label: "Oversized",
    options: [
      { value: "RV", label: "RV" },
      { value: "Camper Van", label: "Camper Van" },
    ],
  },
  {
    label: "Commercial",
    options: [
      { value: "Semi Truck (18-wheeler)", label: "Semi Truck 18-Wheeler" },
      { value: "Flatbed", label: "Flatbed" },
      { value: "Tanker", label: "Tanker" },
      { value: "Box Truck", label: "Box Truck" },
    ],
  },
  {
    label: "Other",
    options: [
      { value: "Boat", label: "Boat" },
      { value: "Ferry", label: "Ferry" },
      { value: "Plane", label: "Plane" },
    ],
  },
  {
    label: "",
    options: [{ value: MULTI_VEHICLE_TRIP, label: "Multi-Vehicle Trip" }],
  },
];

export const VEHICLE_CHOICES = VEHICLE_GROUPS.flatMap(g => g.options.map(o => o.value));
export const MULTI_VEHICLE_CHOICES = VEHICLE_CHOICES.filter(v => v !== MULTI_VEHICLE_TRIP);

export const KIDS_AGE_CHOICES = [];

const DAY_TRIP_MILES = 150;

export function isRouteContextReady(context) {
  if (context?.routeDistanceMiles != null && context.routeDistanceMiles > 0) return true;
  if (context?.routeDurationHours != null && context.routeDurationHours > 0) return true;
  const miles = parseMilesFromDistance(context?.routeDistance);
  if (miles != null && miles > 0) return true;
  return parseHoursFromDuration(context?.routeDuration) != null;
}

function formatRouteSnapshot(context) {
  const dist = context?.routeDistance;
  const dur = context?.routeDuration;
  if (dist && dur) return `${dist} · ${dur}`;
  if (dist) return dist;
  if (dur) return dur;
  return null;
}

const ROUTE_LOADING_QUESTION = {
  id: "_route_loading",
  ask: "Calculating your route…",
  hint: "Hang tight — we'll ask about overnight stops once we know the drive time.",
  type: "loading",
};

export const FLOW_PHASES = [
  { id: "about", label: "Your trip" },
  { id: "route", label: "Route" },
  { id: "details", label: "Details" },
  { id: "done", label: "Ready" },
];

const ABOUT_QUESTION_IDS = new Set([
  "vehicle", "fuel_type", "towing", "travelers", "multi_vehicles", "primary_vehicle",
  "hauling_type", "sleeper_cab", "truck_stop_brand",
]);
const ROUTE_QUESTION_IDS = new Set([
  "preferences", "overnight_preference", "lodging", "_route_loading",
  "route_restrictions", "coordination_needs",
]);
const DETAILS_QUESTION_IDS = new Set([
  "trip_details", "food_and_stops", "food_allergies", "accessibility", "trip_budget",
]);

export function getFlowPhaseId(questionId, convoComplete = false) {
  if (convoComplete) return "done";
  if (!questionId) return "about";
  if (ABOUT_QUESTION_IDS.has(questionId)) return "about";
  if (ROUTE_QUESTION_IDS.has(questionId)) return "route";
  if (DETAILS_QUESTION_IDS.has(questionId)) return "details";
  return "about";
}

export function formatFlowAnswer(question, answer) {
  if (!question) return "";
  if (answer == null) return "—";
  if (question.type === "trip_details" || question.type === "multiselect_group") {
    const parts = [];
    const payload = answer && typeof answer === "object" ? answer : {};
    ["dietary", "stops_interests", "accessibility"].forEach(key => {
      const items = payload[key];
      if (Array.isArray(items) && items.length) parts.push(...items.slice(0, 2));
    });
    if (payload.trip_budget) parts.push(payload.trip_budget);
    return parts.length ? parts.slice(0, 3).join(", ") : "Defaults";
  }
  if (question.type === "lodging_stay") {
    const loyalty = question._loyalty || "";
    return loyalty && loyalty !== "No preference" ? `${answer} · ${loyalty}` : String(answer);
  }
  if (Array.isArray(answer)) return answer.length ? answer.join(", ") : "None";
  if (typeof answer === "object") return "Selected";
  return String(answer);
}

const FUEL_TYPE_QUESTION = {
  id: "fuel_type",
  ask: "What kind of fuel does your vehicle take?",
  hint: "Used to space fuel and charging stops along your route.",
  type: "choice",
  choices: FUEL_TYPE_CHOICES,
};

const TOWING_QUESTION = {
  id: "towing",
  ask: "Are you towing anything?",
  hint: "Affects route restrictions and stop spacing.",
  type: "choice",
  choices: TOWING_CHOICES,
};

const TRAVELERS_QUESTION = {
  id: "travelers",
  ask: "Who's coming along?",
  hint: "Helps us size restaurants, lodging, and rest stops.",
  type: "travelers",
  choices: ["1", "2", "3 to 5", "6 or more"],
};

function buildOvernightPreferenceQuestion(context) {
  const snapshot = formatRouteSnapshot(context);
  const ask = snapshot
    ? `This drive is about ${snapshot}. How do you want to handle it?`
    : "This route is long enough for multiple days. How do you want to handle it?";
  return {
    id: "overnight_preference",
    ask,
    routeSnapshot: snapshot,
    hint: "You can always edit this later before generating.",
    type: "choice",
    choices: [
      {
        value: OVERNIGHT_PREFERENCE_OVERNIGHT,
        label: "Stop overnight along the way",
        description: "We'll suggest hotels and split the drive into days",
      },
      {
        value: OVERNIGHT_PREFERENCE_CONTINUOUS,
        label: "Drive straight through",
        description: "No lodging — fuel and rest stops only",
      },
    ],
  };
}

export const LODGING_CHOICE_OPTIONS = [
  { value: "Budget", label: "Budget — under $80 per night" },
  { value: "Mid-Range", label: "Mid-Range — $80 to $150 per night" },
  { value: "Luxury", label: "Luxury — over $150 per night" },
  { value: "Airbnb or Vacation Rental", label: "Airbnb or Vacation Rental" },
  { value: "Camping or Outdoors", label: "Camping or Outdoors" },
  { value: "Doesn't Matter", label: "Doesn't Matter" },
];

function buildLodgingQuestion(context) {
  const snapshot = formatRouteSnapshot(context);
  return {
    id: "lodging",
    ask: snapshot
      ? `Where would you like to stay along this route? (${snapshot})`
      : "Where would you like to stay along this route?",
    hint: "Optional: pick a hotel loyalty program below before continuing.",
    type: "lodging_stay",
    choices: LODGING_CHOICE_OPTIONS,
    loyaltyChoices: LOYALTY_CHOICES,
  };
}

const FOOD_ALLERGIES_QUESTION = {
  id: "food_allergies",
  ask: "Which food allergies should we plan around?",
  hint: "We'll filter restaurant suggestions on your route.",
  type: "text",
  placeholder: "e.g. peanuts, shellfish, dairy…",
};

const ACCESSIBILITY_QUESTION = {
  id: "accessibility",
  ask: "Any accessibility needs?",
  hint: "We'll prioritize suitable stops and lodging.",
  type: "multiselect",
  choices: ACCESSIBILITY_CHOICES,
};

const TRIP_BUDGET_QUESTION = {
  id: "trip_budget",
  ask: "What's your overall trip budget?",
  hint: "Helps filter restaurants and activity suggestions.",
  type: "choice",
  choices: TRIP_BUDGET_CHOICES,
};

function buildPersonalPreferencesQuestion(context) {
  const snapshot = formatRouteSnapshot(context);
  return {
    id: "preferences",
    ask: snapshot
      ? `Anything we should avoid or prioritize on this drive? (${snapshot})`
      : "Anything we should avoid or prioritize on your route?",
    hint: "Scenic roads, tolls, pet-friendly stops, and more.",
    type: "multiselect",
    choices: ["Scenic route", "Avoid tolls", "Pet friendly", "Fast food only", "Sit down restaurants only", "Avoid highways"],
  };
}

function buildRvPreferencesQuestion(context) {
  const snapshot = formatRouteSnapshot(context);
  return {
    id: "preferences",
    ask: snapshot
      ? `Any RV route preferences? (${snapshot})`
      : "Any route preferences for your RV?",
    hint: "Hookups, grades, propane, and scenic options.",
    type: "multiselect",
    choices: ["Full hookups only", "Dry camping ok", "Need dump stations", "Pet friendly", "Scenic route", "Avoid steep grades", "Propane refill stops"],
  };
}

function buildTripDetailsQuestion(answers) {
  return {
    id: "trip_details",
    pageTitle: "Personalize your trip",
    pageSubtitle: "These preferences help tailor your route recommendations, stops, and dining along the drive.",
    ask: "Anything else we should plan around?",
    hint: "All optional — tap again to deselect, or continue with defaults.",
    type: "trip_details",
    sections: [
      { id: "dietary", label: "Food", choices: DIETARY_CHOICES },
      { id: "stops_interests", label: "Fun stops", choices: getStopsInterestsChoices(answers) },
      { id: "accessibility", label: "Accessibility", choices: ACCESSIBILITY_CHOICES },
    ],
    budgetChoices: TRIP_BUDGET_CHOICES,
  };
}

export const TRUCKER_QUESTION_SEQUENCE = [
  { id: "hauling_type", ask: "What are you hauling?", type: "choice", choices: ["General freight", "Refrigerated load", "Flatbed load", "Tanker load", "Empty"] },
  { id: "sleeper_cab", ask: "Do you have a sleeper cab?", type: "choice", choices: ["Yes I have a sleeper cab", "No I need a motel or hotel"] },
  { id: "truck_stop_brand", ask: "Preferred truck stop?", type: "choice", choices: ["Pilot Flying J", "Love's", "Petro", "TA Travel Center", "No preference"] },
  { id: "route_restrictions", ask: "Any route restrictions?", type: "multiselect", choices: ["Avoid toll roads", "Avoid certain states", "No restrictions"] },
];

const MULTI_VEHICLES_QUESTION = {
  id: "multi_vehicles",
  ask: "Which vehicles are on this trip?",
  type: "multiselect",
  choices: MULTI_VEHICLE_CHOICES,
};

const COORDINATION_QUESTION = {
  id: "coordination_needs",
  ask: "How should the group stay coordinated?",
  hint: "Optional — skip if everyone is on the same page.",
  type: "multiselect",
  choices: [
    "Stay together the whole way",
    "Meet at waypoints",
    "Same hotels every night",
    "Separate overnight stops",
  ],
};

function isTripDetailsAnswered(answers) {
  return isAnswered("dietary", answers)
    && isAnswered("stops_interests", answers)
    && isAnswered("accessibility", answers)
    && isAnswered("trip_budget", answers);
}

export function hasKidsToddlers() {
  return false;
}

export function getRouteDistanceMiles(context) {
  if (context?.routeDistanceMiles != null) return context.routeDistanceMiles;
  return parseMilesFromDistance(context?.routeDistance);
}

export function isDayTripByDistance(context) {
  const miles = getRouteDistanceMiles(context);
  return miles != null && miles < DAY_TRIP_MILES;
}

function isInstantCompleteVehicle(vehicle) {
  return isWaterVehicle(vehicle) || vehicle === "Plane";
}

function isAnswered(id, answers) {
  if (answers[id] === undefined) return false;
  if (Array.isArray(answers[id])) return true;
  return answers[id] !== "";
}

function needsOvernightPreferenceQuestion(answers, context) {
  const effective = getEffectiveVehicle(answers);
  if (isRvVehicle(effective) || isTruckVehicle(effective)) return false;
  if (answers.vehicle === MULTI_VEHICLE_TRIP && answers.primary_vehicle) {
    const primary = getEffectiveVehicle(answers);
    if (isRvVehicle(primary) || isTruckVehicle(primary)) return false;
  }
  if (!isRouteContextReady(context) && !isDayTripByDistance(context)) return true;
  return requiresMultipleDays(context);
}

function needsLodgingQuestion(answers, context) {
  if (isContinuousDrive(answers)) return false;
  if (isDayTripByDistance(context)) return false;
  const effective = getEffectiveVehicle(answers);
  if (isRvVehicle(effective) || isTruckVehicle(effective)) return false;
  if (isPersonalVehicle(effective)) return true;
  if (answers.vehicle === MULTI_VEHICLE_TRIP && answers.primary_vehicle) {
    return isPersonalVehicle(getEffectiveVehicle(answers));
  }
  return false;
}

function buildVehicleQuestion() {
  return { done: false, id: "vehicle", ask: "What kind of vehicle are you driving?", type: "vehicle", groups: VEHICLE_GROUPS, choices: VEHICLE_CHOICES };
}

function buildPrimaryVehicleQuestion(selectedVehicles) {
  const choices = (Array.isArray(selectedVehicles) ? selectedVehicles : []).filter(Boolean);
  return { done: false, id: "primary_vehicle", ask: "What is the primary vehicle?", type: "choice", choices: choices.length ? choices : ["Car"] };
}

function getNextCommercialQuestion(answers) {
  for (const q of TRUCKER_QUESTION_SEQUENCE) {
    if (!isAnswered(q.id, answers)) return { done: false, ...q };
  }
  return null;
}

function getNextUniversalQuestions(answers) {
  if (!isAnswered("accessibility", answers)) return { done: false, ...ACCESSIBILITY_QUESTION };
  return null;
}

function getNextTailQuestions(answers) {
  if (!isTripDetailsAnswered(answers)) return { done: false, ...buildTripDetailsQuestion(answers) };
  if (needsFoodAllergyDetail(answers) && !isAnswered("food_allergies", answers)) {
    return { done: false, ...FOOD_ALLERGIES_QUESTION };
  }
  return null;
}

function getNextPersonalBranchQuestion(answers, context) {
  if (!isAnswered("fuel_type", answers)) return { done: false, ...FUEL_TYPE_QUESTION };
  if (needsTowingQuestion(answers) && !isAnswered("towing", answers)) return { done: false, ...TOWING_QUESTION };
  if (!isAnswered("travelers", answers)) return { done: false, ...TRAVELERS_QUESTION };
  if (!isAnswered("preferences", answers)) return { done: false, ...buildPersonalPreferencesQuestion(context) };

  if (needsOvernightPreferenceQuestion(answers, context) && !isAnswered("overnight_preference", answers)) {
    const overnightQ = buildOvernightPreferenceQuestion(context);
    if (!isRouteContextReady(context)) {
      return { done: false, ...overnightQ, pendingRoute: true };
    }
    if (requiresMultipleDays(context)) {
      return { done: false, ...overnightQ };
    }
  }
  if (needsLodgingQuestion(answers, context) && !isAnswered("lodging", answers)) {
    return { done: false, ...buildLodgingQuestion(context) };
  }

  const tail = getNextTailQuestions(answers);
  if (tail) return tail;
  return null;
}

function getNextRvBranchQuestion(answers, context) {
  if (!isAnswered("fuel_type", answers)) return { done: false, ...FUEL_TYPE_QUESTION };
  if (!isAnswered("travelers", answers)) return { done: false, ...TRAVELERS_QUESTION };
  if (!isAnswered("preferences", answers)) return { done: false, ...buildRvPreferencesQuestion(context) };
  return getNextTailQuestions(answers);
}

function getNextBranchQuestion(effective, answers, context) {
  if (isInstantCompleteVehicle(effective)) return null;
  if (isTruckVehicle(effective)) {
    const truckNext = getNextCommercialQuestion(answers);
    if (truckNext) return truckNext;
    return getNextUniversalQuestions(answers);
  }
  if (isRvVehicle(effective)) return getNextRvBranchQuestion(answers, context);
  if (isPersonalVehicle(effective)) return getNextPersonalBranchQuestion(answers, context);
  return null;
}

function getNextMultiVehicleQuestion(answers, context) {
  if (!isAnswered("multi_vehicles", answers)) return { done: false, ...MULTI_VEHICLES_QUESTION };
  if (!answers.primary_vehicle) return buildPrimaryVehicleQuestion(answers.multi_vehicles);
  const branchNext = getNextBranchQuestion(getEffectiveVehicle(answers), answers, context);
  if (branchNext) return branchNext;
  if (!isAnswered("coordination_needs", answers)) return { done: false, ...COORDINATION_QUESTION };
  return null;
}

function mapFuelTypeToFuel(fuelType) {
  if (!fuelType) return "Gasoline";
  if (fuelType.includes("Tesla")) return "Electric (EV)";
  if (fuelType === "Electric") return "Electric (EV)";
  if (fuelType === "Hybrid") return "Hybrid";
  if (fuelType === "Diesel") return "Diesel";
  if (fuelType === "Propane") return "Propane";
  return "Gasoline";
}

function mapTruckerAnswers(answers) {
  const out = { ...answers };
  if (out.sleeper_cab?.startsWith("Yes")) out.lodging = "Sleeper cab — no hotel needed";
  else if (out.sleeper_cab?.startsWith("No")) out.lodging = "Motel near truck stop";
  if (out.truck_stop_brand && out.truck_stop_brand !== "No preference") out.truck_stop_preference = out.truck_stop_brand;
  return out;
}

export function normalizeTripAnswers(answers, context = {}, options = {}) {
  const vehicle = answers.vehicle || "Car";
  const effective = getEffectiveVehicle(answers);
  let out = applyAssumedVehicleSpecs({ ...answers, vehicle: effective });
  out.vehicle = vehicle;
  out.effective_vehicle = effective;

  const miles = getRouteDistanceMiles(context);
  if (miles != null) out.trip_type = miles < DAY_TRIP_MILES ? "Day trip" : (out.trip_type || "Road trip");
  else if (!out.trip_type) out.trip_type = "Road trip";

  ["preferences", "dietary", "accessibility", "stops_interests", "route_restrictions", "coordination_needs"].forEach(k => {
    if (out[k] == null) return;
    if (!Array.isArray(out[k])) out[k] = [out[k]];
  });

  if (out.fuel_type && !isTruckVehicle(effective)) out.fuel = mapFuelTypeToFuel(out.fuel_type);
  if (isTowingSelected(out)) out.rv_towing = "Yes";

  if (isTruckVehicle(effective)) {
    out.hos_compliance = true;
    out.truck_height = "13'6\"";
    out.truck_weight = "80,000 lbs";
    out.fuel = "Diesel";
    out.fuel_type = "Diesel";
    out = mapTruckerAnswers(out);
  }

  if (isRvVehicle(effective)) out.lodging = "RV parks and campgrounds";
  if (isWaterVehicle(vehicle)) { out.fuel_type = out.fuel_type || "Gasoline"; out.fuel = out.fuel || "Gasoline"; }
  if (isDayTripByDistance(context)) { delete out.lodging; out.trip_type = "Day trip"; }
  if (isContinuousDrive(out)) {
    out.continuous_drive = true;
    out.lodging = "No overnight stay";
    delete out.loyalty_program;
  } else if (out.overnight_preference === OVERNIGHT_PREFERENCE_OVERNIGHT) {
    out.continuous_drive = false;
  }
  if (out.lodging && !out.loyalty_program && out.lodging !== "No overnight stay") {
    out.loyalty_program = "No preference";
  }
  if (vehicle === "Plane") out.trip_type = "Flying";
  if (isWaterVehicle(vehicle)) out.trip_type = "Ferry or Cruise";

  if (options.forGeneration) {
    ["preferences", "dietary", "accessibility", "stops_interests", "route_restrictions", "coordination_needs"].forEach(k => {
      if (!Array.isArray(out[k])) out[k] = out[k] ? [out[k]] : [];
    });
  }

  return out;
}

export function getFlowCompleteMessage(answers, context = {}) {
  const vehicle = answers?.vehicle;
  if (!vehicle) return null;
  if (vehicle === MULTI_VEHICLE_TRIP) {
    if (!answers.primary_vehicle) return null;
    const effective = getEffectiveVehicle(answers);
    if (isWaterVehicle(effective)) return MARINE_SKIP_MESSAGE;
    if (effective === "Plane") return PLANE_SKIP_MESSAGE;
    return null;
  }
  if (isWaterVehicle(vehicle)) return MARINE_SKIP_MESSAGE;
  if (vehicle === "Plane") return PLANE_SKIP_MESSAGE;
  if (isContinuousDrive(answers)) {
    const snapshot = formatRouteSnapshot(context);
    return snapshot
      ? `Drive straight through (${snapshot}) — fuel and rest stops only, no overnight lodging.`
      : "Drive straight through — fuel and rest stops only, no overnight lodging.";
  }
  if (isDayTripByDistance(context)) {
    return "Day trip — no overnight stops needed. Ready to generate your plan?";
  }
  return null;
}

export function getNextFlowQuestion(answers, context = {}) {
  if (!answers?.vehicle) return buildVehicleQuestion();

  if (answers.vehicle === MULTI_VEHICLE_TRIP) {
    const multiNext = getNextMultiVehicleQuestion(answers, context);
    if (multiNext) return multiNext;
    return { done: true, skipMessage: getFlowCompleteMessage(answers, context) };
  }
  if (isWaterVehicle(answers.vehicle)) return { done: true, skipMessage: MARINE_SKIP_MESSAGE };
  if (answers.vehicle === "Plane") return { done: true, skipMessage: PLANE_SKIP_MESSAGE };

  const branchNext = getNextBranchQuestion(getEffectiveVehicle(answers), answers, context);
  if (branchNext) return branchNext;
  return { done: true };
}

export function fetchNextQuestion(answers, context = {}) {
  return getNextFlowQuestion(answers, context);
}

export function countFlowQuestionsAnswered(answers) {
  return FLOW_QUESTION_IDS.filter(id => isAnswered(id, answers)).length;
}

function applyDummyAnswer(sim, q) {
  if (!q || q.type === "loading") return;
  if (q.type === "trip_details") {
    sim.dietary = [];
    sim.stops_interests = [];
    sim.accessibility = [];
    sim.trip_budget = "No budget limit";
    return;
  }
  if (q.type === "multiselect_group") {
    for (const sec of q.sections || []) {
      sim[sec.id] = sec.choices?.length ? [sec.choices[0]] : [];
    }
    return;
  }
  if (q.type === "lodging_stay") {
    sim.lodging = "Mid-Range";
    sim.loyalty_program = "No preference";
    return;
  }
  sim[q.id] = dummyAnswerForQuestion(q);
}

function dummyAnswerForQuestion(q) {
  if (!q) return null;
  if (q.type === "loading") return null;
  if (q.type === "multiselect") return q.choices?.length ? [q.choices[0]] : [];
  if (q.type === "text") return "none";
  if (q.type === "vehicle" && q.groups?.[0]?.options?.[0]) return q.groups[0].options[0].value;
  if (Array.isArray(q.choices) && q.choices.length) {
    const first = q.choices[0];
    return typeof first === "object" ? first.value : first;
  }
  return "Yes";
}

/** Phase-based progress for the plan flow indicator. */
export function getFlowProgress(answers, context = {}, options = {}) {
  const { convoComplete = false, currentQuestionId = null } = options;
  const phaseId = getFlowPhaseId(currentQuestionId, convoComplete);
  const phaseIndex = FLOW_PHASES.findIndex(p => p.id === phaseId);
  const progressPercent = convoComplete
    ? 100
    : ((Math.max(0, phaseIndex) + 0.35) / Math.max(1, FLOW_PHASES.length - 1)) * 100;

  return {
    phases: FLOW_PHASES,
    currentPhaseId: phaseId,
    progressPercent,
    phaseLabel: FLOW_PHASES[phaseIndex]?.label || FLOW_PHASES[0].label,
  };
}

export function pruneSkippedAnswers(answers) {
  return normalizeTripAnswers(answers);
}

export function flowQuestionSkipped() {
  return false;
}

export function countApplicableFlowQuestions() {
  return 12;
}

export function isFlowQuestionComplete(id, answers) {
  return isAnswered(id, answers);
}

export function buildFlowQuestion(id, answers, context = {}) {
  if (id === "vehicle") return buildVehicleQuestion();
  return getNextFlowQuestion(answers, context);
}
