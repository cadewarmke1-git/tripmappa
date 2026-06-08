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
  isMediumLengthTrip,
  OVERNIGHT_PREFERENCE_CONTINUOUS,
  OVERNIGHT_PREFERENCE_OVERNIGHT,
  requiresMultipleDays,
} from "./driveMode.js";
import {
  isPersonalVehicle,
  FUEL_TYPE_CHOICES,
  TOWING_CHOICES,
  MOTORCYCLE_TOWING_CHOICES,
  DIETARY_CHOICES,
  ACCESSIBILITY_CHOICES,
  TRIP_BUDGET_CHOICES,
  LOYALTY_CHOICES,
  getStopsInterestsChoices,
  DESTINATION_INTEREST_CHOICES,
  needsFoodAllergyDetail,
  needsTowingQuestion,
  needsKidsAgesDetail,
  needsTruckExternalLodging,
  isTowingSelected,
  asArray,
} from "./tripAccommodations.js";
import { SCHEDULE_CHOICES, needsScheduleHoursDetail, getScheduleChoicesForContext, SCHEDULE_SPECIFIC_HOURS, SCHEDULE_TRAVEL_SPECIFIC_HOURS } from "./scheduleRestrictions.js";

export { MULTI_VEHICLE_TRIP };

export const MARINE_SKIP_MESSAGE =
  "Marine routing is approximate — Google Maps does not support water navigation. Showing departure and arrival port recommendations only.";
export const PLANE_SKIP_MESSAGE =
  "Showing airport transport, layover recommendations, and destination activity suggestions only.";
export const ROUTE_PENDING_UNLOCK_MS = 8000;

export const SUMMARY_EDIT_QUESTION_BY_ROW = {
  "Vehicle": "vehicle",
  "Primary vehicle": "primary_vehicle",
  "Vehicles on trip": "multi_vehicles",
  "Party size": "travelers",
  "Party composition": "party_composition",
  "Overnight nights": "trip_nights",
  "Lodging": "lodging",
  "Fuel": "fuel_type",
  "Hauling": "hauling_type",
  "Sleeper cab": "sleeper_cab",
  "Truck stops": "truck_stop_brand",
  "Route restrictions": "route_restrictions",
  "Coordination": "coordination_needs",
  "Preferences": "preferences",
  "Drive mode": "overnight_preference",
  "Fuel type": "fuel_type",
};

export const FLOW_QUESTION_IDS = [
  "vehicle", "fuel_type", "towing", "multi_vehicles", "primary_vehicle", "travelers",
  "party_composition", "adult_count", "child_count",
  "overnight_preference", "lodging", "trip_nights", "loyalty_program", "dietary", "food_allergies", "accessibility",
  "stops_interests", "trip_budget", "schedule_restrictions", "schedule_drive_hours", "preferences",
  "hauling_type", "sleeper_cab", "truck_stop_brand", "route_restrictions", "coordination_needs", "kids_ages",
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

export const KIDS_AGES_SKIP = "Not sure / prefer not to say";

export const KIDS_AGE_CHOICES = [
  "Infants (under 2)",
  "Toddlers (2-4)",
  "Young children (5-10)",
  "Tweens (11-13)",
  "Teenagers (14-17)",
  KIDS_AGES_SKIP,
];

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
  "vehicle", "fuel_type", "towing", "travelers", "party_composition", "multi_vehicles", "primary_vehicle",
  "hauling_type", "sleeper_cab", "truck_stop_brand",
]);
const ROUTE_QUESTION_IDS = new Set([
  "preferences", "overnight_preference", "lodging", "trip_nights", "_route_loading",
  "route_restrictions", "coordination_needs",
]);
const DETAILS_QUESTION_IDS = new Set([
  "trip_details", "food_and_stops", "food_allergies", "schedule_drive_hours", "accessibility", "trip_budget",
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
    if (Array.isArray(payload.schedule_restrictions) && payload.schedule_restrictions.length) {
      parts.push(...payload.schedule_restrictions.slice(0, 1));
    }
    if (payload.trip_budget) parts.push(payload.trip_budget);
    return parts.length ? parts.slice(0, 3).join(", ") : "Defaults";
  }
  if (question.type === "lodging_stay") {
    const loyalty = question._loyalty || "";
    return loyalty && loyalty !== "No preference" ? `${answer} · ${loyalty}` : String(answer);
  }
  if (question.id === "party_composition" || question.type === "party_composition") {
    const payload = answer && typeof answer === "object" ? answer : {};
    const adults = payload.adults ?? payload.adult_count;
    const children = payload.children ?? payload.child_count;
    if (adults != null && children != null) {
      return `${adults} adult${adults === 1 ? "" : "s"}, ${children} child${children === 1 ? "" : "ren"}`;
    }
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

const MOTORCYCLE_TOWING_QUESTION = {
  id: "towing",
  ask: "Are you traveling with a trailer or sidecar?",
  hint: "Only applies on longer rides — affects stop and parking suggestions.",
  type: "choice",
  choices: MOTORCYCLE_TOWING_CHOICES,
};

function buildTowingQuestion(answers) {
  if (getEffectiveVehicle(answers) === "Motorcycle") return MOTORCYCLE_TOWING_QUESTION;
  return TOWING_QUESTION;
}

const TRAVELERS_QUESTION = {
  id: "travelers",
  ask: "Who's coming along?",
  hint: "Helps us size restaurants, lodging, and rest stops.",
  type: "travelers",
  choices: ["1", "2", "3 to 5", "6 or more"],
};

const PARTY_COMPOSITION_QUESTION = {
  id: "party_composition",
  ask: "How many are adults and how many are children?",
  hint: "Helps us size lodging and family-friendly stops.",
  type: "party_composition",
  adultRange: [1, 8],
  childRange: [0, 6],
};

const TRIP_NIGHTS_QUESTION = {
  id: "trip_nights",
  ask: "How many nights are you planning to stop?",
  hint: "We'll spread overnight stops evenly across your route.",
  type: "choice",
  choices: ["1 night", "2 nights", "3 nights", "4+ nights", "Not sure"],
};

function needsPartyCompositionQuestion(answers) {
  const t = answers.travelers;
  if (t !== "3 to 5" && t !== "6 or more") return false;
  return answers.adult_count == null || answers.child_count == null;
}

function needsTripNightsQuestion(answers, context) {
  if (answers.overnight_preference !== OVERNIGHT_PREFERENCE_OVERNIGHT) return false;
  if (!requiresMultipleDays(context)) return false;
  if (isContinuousDrive(answers)) return false;
  if (isDayTripByDistance(context)) return false;
  const effective = getEffectiveVehicle(answers);
  if (isRvVehicle(effective) || isTruckVehicle(effective)) return false;
  if (!isAnswered("lodging", answers)) return false;
  return !isAnswered("trip_nights", answers);
}

function needsRvTripNightsQuestion(answers, context) {
  if (!requiresMultipleDays(context)) return false;
  if (!isRvVehicle(getEffectiveVehicle(answers))) return false;
  if (!isAnswered("preferences", answers)) return false;
  return !isAnswered("trip_nights", answers);
}

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
    mediumTripHint: isMediumLengthTrip(context)
      ? "Most people complete this drive in one day, but stopping overnight is always an option."
      : null,
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

const SCHEDULE_DRIVE_HOURS_QUESTION = {
  id: "schedule_drive_hours",
  ask: "When do you prefer to drive?",
  hint: "Example: weekdays 8 AM–6 PM only, or no driving after 8 PM.",
  type: "text",
  placeholder: "e.g. weekdays 8 AM to 6 PM only",
};

export function buildScheduleDriveHoursQuestion(answers = {}) {
  const effective = getEffectiveVehicle(answers);
  if (effective === "Plane" || effective === "Ferry") {
    return {
      id: "schedule_drive_hours",
      ask: "When do you prefer to travel?",
      hint: "Example: weekday mornings only, or no late-night connections.",
      type: "text",
      placeholder: "e.g. weekdays 8 AM to 6 PM only",
    };
  }
  if (isWaterVehicle(effective)) {
    return {
      id: "schedule_drive_hours",
      ask: "When do you prefer to travel?",
      hint: "Example: sail only during daylight, or avoid overnight crossings.",
      type: "text",
      placeholder: "e.g. daylight hours only",
    };
  }
  if (isTruckVehicle(effective)) {
    return {
      id: "schedule_drive_hours",
      ask: "What are your preferred hours on the road?",
      hint: "Example: weekdays 6 AM–8 PM only, or no driving after 10 PM.",
      type: "text",
      placeholder: "e.g. weekdays 6 AM to 8 PM only",
    };
  }
  return { ...SCHEDULE_DRIVE_HOURS_QUESTION };
}

const KIDS_AGES_QUESTION = {
  id: "kids_ages",
  ask: "What ages are the children traveling with you?",
  hint: "Helps us suggest age-appropriate stops and rest break spacing.",
  type: "multiselect",
  choices: KIDS_AGE_CHOICES,
};

function buildTruckLodgingQuestion() {
  return {
    id: "lodging",
    ask: "What tier of motel or hotel do you prefer for overnight stops?",
    hint: "Truck-accessible lodging near major stops along your route.",
    type: "choice",
    choices: LODGING_CHOICE_OPTIONS.map(o => o.value),
  };
}

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
    choices: ["Scenic route", "Avoid tolls", "Pet friendly", "Safe, well-lit stops only", "Fast food only", "Sit down restaurants only", "Avoid highways"],
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
  const effective = getEffectiveVehicle(answers);
  const isTruck = isTruckVehicle(effective);
  return {
    id: "trip_details",
    pageTitle: "Personalize your trip",
    pageSubtitle: isTruck
      ? "These preferences help tailor rest breaks, fuel stops, and dining along your route."
      : "These preferences help tailor your route recommendations, stops, and dining along the drive.",
    ask: "Anything else we should plan around?",
    hint: "All optional — tap again to deselect, or continue with defaults.",
    type: "trip_details",
    sections: [
      { id: "dietary", label: "Food", choices: DIETARY_CHOICES },
      { id: "stops_interests", label: "Fun stops", choices: getStopsInterestsChoices(answers) },
      { id: "accessibility", label: "Accessibility & medical", choices: ACCESSIBILITY_CHOICES },
      { id: "schedule_restrictions", label: "Schedule", choices: getScheduleChoicesForContext(answers) },
    ],
    budgetChoices: TRIP_BUDGET_CHOICES,
  };
}

function isThinTransportVehicle(vehicle) {
  return vehicle === "Plane" || isWaterVehicle(vehicle);
}

function needsThinTransportDestinationInterests(answers) {
  const effective = getEffectiveVehicle(answers);
  return effective === "Plane" || effective === "Ferry";
}

function isThinTransportDetailsAnswered(answers) {
  const base = isAnswered("dietary", answers)
    && isAnswered("accessibility", answers)
    && isAnswered("schedule_restrictions", answers)
    && isAnswered("trip_budget", answers);
  if (needsThinTransportDestinationInterests(answers)) {
    return base && isAnswered("stops_interests", answers);
  }
  return base;
}

function buildThinTransportDetailsQuestion(answers) {
  const withDest = needsThinTransportDestinationInterests(answers);
  const effective = getEffectiveVehicle(answers);
  const isPlane = effective === "Plane";
  return {
    id: "trip_details",
    pageTitle: "Personalize your trip",
    pageSubtitle: isPlane
      ? "Your carrier handles routing — tell us about your party and what you want at the destination."
      : withDest
        ? "Tell us about your party and what you'd like to explore when you arrive."
        : "Tell us about your party so we can tailor port and activity suggestions.",
    ask: "Anything we should plan around for this trip?",
    hint: "All optional — tap again to deselect, or continue with defaults.",
    type: "trip_details",
    sections: [
      { id: "dietary", label: "Food", choices: DIETARY_CHOICES },
      ...(withDest ? [{ id: "stops_interests", label: "Destination interests", choices: DESTINATION_INTEREST_CHOICES }] : []),
      { id: "accessibility", label: "Accessibility & medical", choices: ACCESSIBILITY_CHOICES },
      { id: "schedule_restrictions", label: "Schedule", choices: getScheduleChoicesForContext(answers) },
    ],
    budgetChoices: TRIP_BUDGET_CHOICES,
  };
}

function getNextThinTransportQuestions(answers) {
  if (!isAnswered("travelers", answers)) {
    const effective = getEffectiveVehicle(answers);
    const hint = effective === "Plane"
      ? "Helps size airport dining, lodging, and activity suggestions."
      : "Helps size dining, lodging, and activity suggestions along your trip.";
    return { done: false, ...TRAVELERS_QUESTION, hint };
  }
  if (needsPartyCompositionQuestion(answers)) {
    return { done: false, ...PARTY_COMPOSITION_QUESTION };
  }
  if (!isThinTransportDetailsAnswered(answers)) {
    return { done: false, ...buildThinTransportDetailsQuestion(answers) };
  }
  const tail = getNextTailFollowups(answers);
  if (tail) return tail;
  return null;
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
    && isAnswered("schedule_restrictions", answers)
    && isAnswered("trip_budget", answers);
}

export function hasKidsToddlers(answers) {
  return asArray(answers?.kids_ages).some(a => /Infants \(under 2\)|Toddlers \(2-4\)/.test(a));
}

export function getRouteDistanceMiles(context) {
  if (context?.routeDistanceMiles != null) return context.routeDistanceMiles;
  return parseMilesFromDistance(context?.routeDistance);
}

export function isDayTripByDistance(context) {
  const miles = getRouteDistanceMiles(context);
  return miles != null && miles < DAY_TRIP_MILES;
}

function shouldPendingOvernightRoute(answers, context) {
  return !isRouteContextReady(context)
    && !context.routeFailed
    && !answers.route_context_unavailable;
}

function isAnswered(id, answers) {
  if (answers[id] === undefined) return false;
  if (Array.isArray(answers[id])) {
    if (id === "multi_vehicles") return answers[id].length > 0;
    return true;
  }
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
  if (answers.overnight_preference !== OVERNIGHT_PREFERENCE_OVERNIGHT) return false;
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

/** No-sleeper commercial trucks — same route gate as personal overnight preference. */
function needsTruckOvernightPreferenceQuestion(answers, context) {
  if (!needsTruckExternalLodging(answers)) return false;
  if (isDayTripByDistance(context)) return false;
  if (!isRouteContextReady(context) && !isDayTripByDistance(context)) return true;
  return requiresMultipleDays(context);
}

function needsTruckLodgingQuestion(answers, context) {
  if (!needsTruckExternalLodging(answers)) return false;
  if (isContinuousDrive(answers)) return false;
  if (answers.overnight_preference !== OVERNIGHT_PREFERENCE_OVERNIGHT) return false;
  if (isDayTripByDistance(context)) return false;
  return true;
}

function getNextTruckOvernightQuestion(answers, context) {
  if (!needsTruckOvernightPreferenceQuestion(answers, context)) return null;
  if (isAnswered("overnight_preference", answers)) return null;
  const overnightQ = buildOvernightPreferenceQuestion(context);
  if (shouldPendingOvernightRoute(answers, context)) {
    return { done: false, ...overnightQ, pendingRoute: true };
  }
  if (requiresMultipleDays(context) || context.routeFailed || answers.route_context_unavailable) {
    return {
      done: false,
      ...overnightQ,
      hint: answers.route_context_unavailable
        ? "Route details are still loading — your answer will be used as-is."
        : context.routeFailed
          ? "We couldn't calculate drive time — choose what fits your plan."
          : overnightQ.hint,
    };
  }
  return null;
}

function getNextTruckBranchAfterCommercial(answers, context) {
  const truckOvernight = getNextTruckOvernightQuestion(answers, context);
  if (truckOvernight) return truckOvernight;
  if (needsTruckLodgingQuestion(answers, context) && !isAnswered("lodging", answers)) {
    return { done: false, ...buildTruckLodgingQuestion() };
  }
  return getNextTailQuestions(answers);
}

function buildVehicleQuestion() {
  return { done: false, id: "vehicle", ask: "How are you traveling?", type: "vehicle", groups: VEHICLE_GROUPS, choices: VEHICLE_CHOICES };
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

function getNextTailFollowups(answers) {
  if (needsKidsAgesDetail(answers) && !isAnswered("kids_ages", answers)) {
    return { done: false, ...KIDS_AGES_QUESTION };
  }
  if (needsFoodAllergyDetail(answers) && !isAnswered("food_allergies", answers)) {
    return { done: false, ...FOOD_ALLERGIES_QUESTION };
  }
  if (needsScheduleHoursDetail(answers) && !isAnswered("schedule_drive_hours", answers)) {
    return { done: false, ...buildScheduleDriveHoursQuestion(answers) };
  }
  return null;
}

function getNextTailQuestions(answers) {
  if (!isTripDetailsAnswered(answers)) return { done: false, ...buildTripDetailsQuestion(answers) };
  return getNextTailFollowups(answers);
}

function getNextPersonalBranchQuestion(answers, context) {
  if (!isAnswered("fuel_type", answers)) return { done: false, ...FUEL_TYPE_QUESTION };
  if (needsTowingQuestion(answers, context) && !isAnswered("towing", answers)) {
    return { done: false, ...buildTowingQuestion(answers) };
  }
  if (!isAnswered("travelers", answers)) return { done: false, ...TRAVELERS_QUESTION };
  if (needsPartyCompositionQuestion(answers)) return { done: false, ...PARTY_COMPOSITION_QUESTION };
  if (!isAnswered("preferences", answers)) return { done: false, ...buildPersonalPreferencesQuestion(context) };

  if (needsOvernightPreferenceQuestion(answers, context) && !isAnswered("overnight_preference", answers)) {
    const overnightQ = buildOvernightPreferenceQuestion(context);
    if (shouldPendingOvernightRoute(answers, context)) {
      return { done: false, ...overnightQ, pendingRoute: true };
    }
    if (requiresMultipleDays(context) || context.routeFailed || answers.route_context_unavailable) {
      return {
        done: false,
        ...overnightQ,
        hint: answers.route_context_unavailable
          ? "Route details are still loading — your answer will be used as-is."
          : context.routeFailed
            ? "We couldn't calculate drive time — choose what fits your plan."
            : overnightQ.hint,
      };
    }
  }
  if (needsLodgingQuestion(answers, context) && !isAnswered("lodging", answers)) {
    return { done: false, ...buildLodgingQuestion(context) };
  }
  if (needsTripNightsQuestion(answers, context)) {
    return { done: false, ...TRIP_NIGHTS_QUESTION };
  }

  const tail = getNextTailQuestions(answers);
  if (tail) return tail;
  return null;
}

function getNextRvBranchQuestion(answers, context) {
  if (!isAnswered("fuel_type", answers)) return { done: false, ...FUEL_TYPE_QUESTION };
  if (!isAnswered("travelers", answers)) return { done: false, ...TRAVELERS_QUESTION };
  if (needsPartyCompositionQuestion(answers)) return { done: false, ...PARTY_COMPOSITION_QUESTION };
  if (!isAnswered("preferences", answers)) return { done: false, ...buildRvPreferencesQuestion(context) };
  if (needsRvTripNightsQuestion(answers, context)) {
    return { done: false, ...TRIP_NIGHTS_QUESTION };
  }
  return getNextTailQuestions(answers);
}

/** Personal-car overnight/lodging — must not appear for RV or truck primaries (incl. multi-vehicle). */
function isPersonalOvernightOrLodgingQuestion(question) {
  if (!question) return false;
  return question.id === "overnight_preference"
    || question.id === "lodging"
    || question.type === "lodging_stay";
}

/**
 * Multi-vehicle routing after primary_vehicle:
 * - Plane/Boat/Ferry primary → thin transport mini-flow (travelers → trip_details → follow-ups).
 * - RV primary → full RV branch (fuel → travelers → preferences → trip_nights if multi-day → trip_details), then coordination.
 * - Truck primary → full truck branch (hauling → sleeper → truck stop → restrictions → lodging if no sleeper → trip_details), then coordination.
 * - Car/other personal primary → personal branch (may include overnight/lodging), then coordination.
 */
function guardMultiVehicleBranchNext(effective, branchNext, answers, context) {
  if (isRvVehicle(effective) || isTruckVehicle(effective)) {
    if (isPersonalOvernightOrLodgingQuestion(branchNext)) {
      if (isTruckVehicle(effective)) {
        const truckNext = getNextCommercialQuestion(answers);
        if (truckNext) return truckNext;
        return getNextTruckBranchAfterCommercial(answers, context);
      }
      return getNextRvBranchQuestion(answers, context);
    }
  }
  return branchNext;
}

function getNextBranchQuestion(effective, answers, context) {
  if (isThinTransportVehicle(effective)) {
    return getNextThinTransportQuestions(answers);
  }
  if (isTruckVehicle(effective)) {
    const truckNext = getNextCommercialQuestion(answers);
    if (truckNext) return truckNext;
    return getNextTruckBranchAfterCommercial(answers, context);
  }
  if (isRvVehicle(effective)) return getNextRvBranchQuestion(answers, context);
  if (isPersonalVehicle(effective)) return getNextPersonalBranchQuestion(answers, context);
  return null;
}

function getNextMultiVehicleQuestion(answers, context) {
  if (!isAnswered("multi_vehicles", answers)) return { done: false, ...MULTI_VEHICLES_QUESTION };
  if (!answers.primary_vehicle) return buildPrimaryVehicleQuestion(answers.multi_vehicles);
  const effective = getEffectiveVehicle(answers);
  const branchNext = guardMultiVehicleBranchNext(
    effective,
    getNextBranchQuestion(effective, answers, context),
    answers,
    context,
  );
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
  else if (
    out.sleeper_cab?.startsWith("No")
    && !out.lodging
    && out.overnight_preference === OVERNIGHT_PREFERENCE_OVERNIGHT
  ) {
    out.lodging = "Mid-Range";
  }
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

  ["preferences", "dietary", "accessibility", "stops_interests", "route_restrictions", "coordination_needs", "schedule_restrictions"].forEach(k => {
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

  const thinTransport = effective === "Plane" || effective === "Ferry" || isWaterVehicle(effective);
  if (thinTransport && Array.isArray(out.schedule_restrictions)) {
    out.schedule_restrictions = out.schedule_restrictions.map(s =>
      s === SCHEDULE_SPECIFIC_HOURS ? SCHEDULE_TRAVEL_SPECIFIC_HOURS : s,
    );
  }

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
    ["preferences", "dietary", "accessibility", "stops_interests", "route_restrictions", "coordination_needs", "schedule_restrictions"].forEach(k => {
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
  if (isWaterVehicle(answers.vehicle) || answers.vehicle === "Plane") {
    const branchNext = getNextBranchQuestion(getEffectiveVehicle(answers), answers, context);
    if (branchNext) return branchNext;
    return { done: true, skipMessage: getFlowCompleteMessage(answers, context) };
  }

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
  if (q.type === "party_composition") {
    sim.adult_count = 2;
    sim.child_count = 1;
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

export function pruneSkippedAnswers(answers, context = {}) {
  return normalizeTripAnswers(answers, context);
}

/** Drop answers from branches that no longer apply after vehicle or route changes. */
export function pruneStaleBranchAnswers(answers, context = {}) {
  const effective = getEffectiveVehicle(answers);
  const out = { ...answers };

  if (!isTruckVehicle(effective)) {
    ["hauling_type", "sleeper_cab", "truck_stop_brand", "truck_stop_preference", "route_restrictions", "hos_compliance"].forEach(k => delete out[k]);
  }
  if (!isRvVehicle(effective)) {
    ["rv_height", "rv_weight", "rv_towing"].forEach(k => delete out[k]);
  }
  if (!isPersonalVehicle(effective)) {
    ["towing"].forEach(k => delete out[k]);
  }
  if (isRvVehicle(effective)) {
    delete out.overnight_preference;
    delete out.lodging;
    delete out.loyalty_program;
  }
  if (isTruckVehicle(effective)) {
    if (!needsTruckExternalLodging(out)) {
      delete out.overnight_preference;
      delete out.lodging;
      delete out.loyalty_program;
    } else if (isContinuousDrive(out)) {
      delete out.lodging;
      delete out.loyalty_program;
    }
  }
  if (answers.vehicle !== MULTI_VEHICLE_TRIP) {
    delete out.multi_vehicles;
    delete out.primary_vehicle;
    delete out.coordination_needs;
  }
  if (Array.isArray(out.multi_vehicles) && out.primary_vehicle && !out.multi_vehicles.includes(out.primary_vehicle)) {
    delete out.primary_vehicle;
  }
  if (!needsScheduleHoursDetail(out)) {
    delete out.schedule_drive_hours;
  }
  if (!needsKidsAgesDetail(out)) {
    delete out.kids_ages;
  }
  if (out.travelers !== "3 to 5" && out.travelers !== "6 or more") {
    delete out.adult_count;
    delete out.child_count;
  }
  if (!needsTripNightsQuestion(out, context) && !needsRvTripNightsQuestion(out, context)) {
    delete out.trip_nights;
  }
  if (isTruckVehicle(effective) && !needsTruckExternalLodging(out)) {
    if (out.sleeper_cab?.startsWith("Yes")) out.lodging = "Sleeper cab — no hotel needed";
    else if (out.sleeper_cab?.startsWith("No")) delete out.lodging;
  }

  return normalizeTripAnswers(out, context);
}

export function pruneRouteDependentAnswers(answers, context = {}) {
  const out = { ...answers };
  delete out.overnight_preference;
  delete out.continuous_drive;
  delete out.lodging;
  delete out.loyalty_program;
  delete out.trip_nights;
  delete out.route_context_unavailable;
  return normalizeTripAnswers(out, context);
}

export function warnContinuousDriveFeasibility(context) {
  const hours = context?.routeDurationHours ?? parseHoursFromDuration(context?.routeDuration);
  const miles = context?.routeDistanceMiles ?? parseMilesFromDistance(context?.routeDistance);
  if (hours != null && hours > 10) {
    return `This route is about ${Math.round(hours)} hours of driving. Federal guidance recommends breaks and rest — are you sure you want to drive straight through?`;
  }
  if (miles != null && miles > 600) {
    return `This route is about ${Math.round(miles)} miles. Driving straight through may not be realistic without rest stops.`;
  }
  return null;
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
