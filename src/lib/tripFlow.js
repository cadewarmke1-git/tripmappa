import {
  isTruckVehicle,
  isRvVehicle,
  isWaterVehicle,
  applyAssumedVehicleSpecs,
  getEffectiveVehicle,
  MULTI_VEHICLE_TRIP,
  formatTravelersLabel,
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
  "We can't chart water routes like a road trip — we'll focus on your departure port, arrival port, and things to do when you get there.";
export const PLANE_SKIP_MESSAGE =
  "Your airline handles the route — we'll help with airport transfers, layovers, and ideas at your destination.";
export const ROUTE_PENDING_UNLOCK_MS = 8000;

export const FLOW_QUESTION_IDS = [
  "route_setup", "vehicle", "fuel_type", "towing", "multi_vehicles", "primary_vehicle", "travelers",
  "party_composition", "adult_count", "child_count", "stop_frequency", "trip_pace", "luxury_level",
  "overnight_preference", "lodging", "trip_nights", "loyalty_program", "dietary", "food_allergies", "accessibility",
  "stops_interests", "trip_budget", "schedule_restrictions", "schedule_drive_hours", "preferences", "what_matters",
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

const ROUTE_CONTEXT_PENDING_QUESTION = {
  id: "route_context_pending",
  type: "loading",
  ask: "Still calculating your drive time…",
  hint: "This usually takes just a few seconds.",
  pendingRoute: true,
};

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
  ask: "Still calculating your drive time…",
  hint: "Hang tight — we'll ask about overnight stops once we know how long the drive is.",
  type: "loading",
};

export const FLOW_PHASES = [
  { id: "about", label: "Your trip" },
  { id: "route", label: "Route" },
  { id: "details", label: "Details" },
  { id: "done", label: "Ready" },
];

const ABOUT_QUESTION_IDS = new Set([
  "route_setup", "vehicle", "fuel_type", "towing", "travelers", "party_composition",
  "stop_frequency", "trip_pace", "luxury_level", "multi_vehicles", "primary_vehicle",
  "hauling_type", "sleeper_cab", "truck_stop_brand", "trip_draft", "ev_charging_network",
  "rv_dimensions", "truck_dimensions",
]);
const ROUTE_QUESTION_IDS = new Set([
  "preferences", "what_matters", "overnight_preference", "lodging", "trip_nights", "_route_loading",
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
  if (question.id === "route_setup" && typeof answer === "string") return answer;
  if (question.type === "trip_details" || question.type === "multiselect_group") {
    const parts = [];
    const payload = answer && typeof answer === "object" ? answer : {};
    ["preferences", "dietary", "stops_interests", "accessibility"].forEach(key => {
      const items = payload[key];
      if (Array.isArray(items) && items.length) parts.push(...items.slice(0, 2));
    });
    if (Array.isArray(payload.schedule_restrictions) && payload.schedule_restrictions.length) {
      parts.push(...payload.schedule_restrictions.slice(0, 1));
    }
    if (payload.food_allergies && payload.food_allergies !== "None specified") {
      parts.push(payload.food_allergies);
    }
    return parts.length ? parts.slice(0, 3).join(", ") : "Defaults";
  }
  if (question.type === "lodging_stay") {
    const loyalty = question._loyalty || "";
    return loyalty && loyalty !== "No preference" ? `${answer} · ${loyalty}` : String(answer);
  }
  if (question.id === "travelers" || question.type === "travelers") {
    return formatTravelersLabel(answer) || "—";
  }
  if (question.id === "luxury_level" || question.display === "star_rating") {
    return formatLuxuryLevelLabel(answer) || "—";
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
  ask: "What does your vehicle run on?",
  hint: "We'll place fuel and charging stops at sensible intervals.",
  type: "choice",
  choices: FUEL_TYPE_CHOICES,
};

const TOWING_QUESTION = {
  id: "towing",
  ask: "Are you towing a trailer or boat?",
  hint: "Helps us avoid tight turns and find pull-through parking.",
  type: "choice",
  choices: TOWING_CHOICES,
};

const MOTORCYCLE_TOWING_QUESTION = {
  id: "towing",
  ask: "Are you carrying a sidecar or cargo trailer?",
  hint: "Only applies on longer rides — affects parking and stop suggestions.",
  type: "choice",
  choices: MOTORCYCLE_TOWING_CHOICES,
};

function buildTowingQuestion(answers) {
  if (getEffectiveVehicle(answers) === "Motorcycle") return MOTORCYCLE_TOWING_QUESTION;
  return TOWING_QUESTION;
}

const PARTY_COMPOSITION_QUESTION = {
  id: "party_composition",
  ask: "Who's coming along?",
  hint: "Set adults and kids — we'll size restaurants, rooms, and rest stops to match.",
  type: "party_composition",
  adultRange: [1, 8],
  childRange: [0, 6],
};

/** Derive the legacy travelers band from exact party counts (generation still expects travelers). */
export function deriveTravelersBand(adults, children) {
  const total = Math.max(0, Number(adults) || 0) + Math.max(0, Number(children) || 0);
  if (total <= 1) return "1";
  if (total === 2) return "2";
  if (total <= 5) return "3 to 5 travelers";
  return "6 or more travelers";
}

const STOP_FREQUENCY_QUESTION = {
  id: "stop_frequency",
  ask: "What's your trip pace?",
  hint: "We'll derive how many stops to plan from your pace and route length.",
  type: "choice",
  choices: [
    {
      value: "Minimal",
      label: "Minimal",
      description: "Drive straight through with only essential stops",
    },
    {
      value: "Moderate",
      label: "Moderate",
      description: "A few breaks and one or two points of interest",
    },
    {
      value: "Frequent",
      label: "Frequent",
      description: "Lots of stops — take it slow and explore",
    },
  ],
};

/** Map trip pace + route length to the legacy stop_count label used in generation hints. */
export function deriveStopCountFromPace(frequency, context = {}) {
  const miles = getRouteDistanceMiles(context);
  const m = miles != null && miles > 0 ? miles : 200;
  if (frequency === "Minimal") {
    return m < 300 ? "Just one stop" : "A few (2-3)";
  }
  if (frequency === "Frequent") {
    return m < 200 ? "Several (4-6)" : "Plenty (7+)";
  }
  // Moderate default
  if (m < 150) return "Just one stop";
  if (m < 400) return "A few (2-3)";
  return "Several (4-6)";
}

export const LUXURY_LEVEL_CHOICES = [
  {
    value: "1",
    label: "Budget",
    stars: 1,
    description: "Under $80/night hotels and casual dining",
  },
  {
    value: "2",
    label: "Economy",
    stars: 2,
    description: "$80–120/night and sit-down restaurants",
  },
  {
    value: "3",
    label: "Mid-range",
    stars: 3,
    description: "$120–180/night and quality dining",
  },
  {
    value: "4",
    label: "Upscale",
    stars: 4,
    description: "$180–250/night and fine dining",
  },
  {
    value: "5",
    label: "Luxury",
    stars: 5,
    description: "$250+/night and premium everything",
  },
];

const LUXURY_LEVEL_QUESTION = {
  id: "luxury_level",
  ask: "What's your spending style for hotels and restaurants?",
  hint: "We'll match lodging and dining to this level — no separate total-budget question.",
  type: "choice",
  display: "star_rating",
  choices: LUXURY_LEVEL_CHOICES,
};

function needsStopFrequencyQuestion(answers, context = {}) {
  const effective = getEffectiveVehicle(answers);
  if (isTruckVehicle(effective) || isThinTransportVehicle(effective)) return false;
  if (!isPersonalVehicle(effective) && !isRvVehicle(effective)) return false;
  return !isQuestionDone("stop_frequency", answers, context);
}

function needsLuxuryLevelQuestion(answers, context = {}) {
  const effective = getEffectiveVehicle(answers);
  if (isTruckVehicle(effective) || isThinTransportVehicle(effective)) return false;
  if (!isPersonalVehicle(effective) && !isRvVehicle(effective)) return false;
  return !isQuestionDone("luxury_level", answers, context);
}

export function formatLuxuryLevelLabel(value) {
  const choice = LUXURY_LEVEL_CHOICES.find(c => String(c.value) === String(value));
  if (!choice) return value ? String(value) : "";
  const stars = "★".repeat(choice.stars);
  return `${stars} ${choice.label} — ${choice.description}`;
}

/** Silent defaults applied when the user continues from route setup without Customize. */
export const SMART_TRIP_DEFAULTS = {
  vehicle: "Car",
  fuel_type: "Gasoline",
  towing: "No",
  stop_frequency: "Moderate",
  luxury_level: "3",
  adult_count: 2,
  child_count: 0,
  preferences: [],
  stops_interests: [],
  dietary: [],
  accessibility: [],
  schedule_restrictions: [],
};

export function formatSmartDefaultsSummary(answers = {}) {
  const vehicle = answers.vehicle || SMART_TRIP_DEFAULTS.vehicle;
  const fuel = answers.fuel_type || SMART_TRIP_DEFAULTS.fuel_type;
  const pace = answers.stop_frequency || SMART_TRIP_DEFAULTS.stop_frequency;
  const luxury = answers.luxury_level || SMART_TRIP_DEFAULTS.luxury_level;
  const luxuryLabel = LUXURY_LEVEL_CHOICES.find(c => String(c.value) === String(luxury))?.label || "Mid-range";
  const fuelShort = String(fuel).includes("Electric") ? "Electric" : String(fuel).split("—")[0].trim();
  return `${vehicle} · ${fuelShort} · ${pace} pace · ${luxuryLabel}`;
}

/**
 * Apply draft-first smart defaults for fields the user did not customize.
 * Does not set party composition, overnight strategy, EV networks, or truck/RV dimensions.
 */
export function applySmartTripDefaults(answers = {}) {
  const out = { ...answers };
  for (const [key, value] of Object.entries(SMART_TRIP_DEFAULTS)) {
    if (out[key] == null || out[key] === "") {
      out[key] = Array.isArray(value) ? [...value] : value;
    }
  }
  out._smartDefaultsApplied = true;
  out._draftFirstFlow = true;
  delete out._customizeTrip;
  if (out.adult_count != null && out.child_count != null) {
    out.travelers = deriveTravelersBand(out.adult_count, out.child_count);
  }
  return out;
}

export function beginDraftFirstCustomize(answers = {}) {
  return {
    ...answers,
    _draftFirstFlow: true,
    _customizeTrip: true,
    _smartDefaultsApplied: false,
  };
}

/** Personal vehicles eligible for the draft-first primary path. */
export function isDraftFirstEligible(answers = {}) {
  if (!answers._draftFirstFlow) return false;
  if (answers.vehicle === MULTI_VEHICLE_TRIP) return false;
  const effective = getEffectiveVehicle(answers);
  if (isTruckVehicle(effective) || isRvVehicle(effective)) return false;
  if (effective === "Plane" || isWaterVehicle(effective)) return false;
  return isPersonalVehicle(effective);
}

const EV_CHARGING_QUESTION = {
  id: "ev_charging_network",
  ask: "Which charging network should we prioritize?",
  hint: "We'll place chargers that match your network along the route.",
  type: "choice",
  choices: [
    "Any fast chargers",
    "Tesla Superchargers",
    "Electrify America",
    "No preference",
  ],
};

const RV_DIMENSIONS_QUESTION = {
  id: "rv_dimensions",
  ask: "Confirm your RV height for low-clearance routing",
  hint: "We use this to avoid bridges and tunnels that are too low.",
  type: "choice",
  choices: ["Under 10'", "10'–11'", "11'–12'", "Over 12' / not sure"],
};

const TRUCK_DIMENSIONS_QUESTION = {
  id: "truck_dimensions",
  ask: "Confirm your truck clearance height",
  hint: "Standard tractor-trailers are usually 13'6\".",
  type: "choice",
  choices: ["13'6\" standard", "14'0\" oversized", "Under 13'6\"", "Not sure"],
};

function needsEvChargingInterrupt(answers, context = {}) {
  const fuel = String(answers.fuel_type || answers.fuel || "");
  if (!/electric/i.test(fuel)) return false;
  if (isQuestionDone("ev_charging_network", answers, context)) return false;
  if (fuel.includes("Tesla")) return false;
  return true;
}

function needsOvernightHardInterrupt(answers, context = {}) {
  const hours = context?.routeDurationHours ?? parseHoursFromDuration(context?.routeDuration);
  if (hours == null || hours < 8) return false;
  if (isDayTripByDistance(context)) return false;
  if (isQuestionDone("overnight_preference", answers, context)) return false;
  const effective = getEffectiveVehicle(answers);
  if (isRvVehicle(effective) || isTruckVehicle(effective)) return false;
  return true;
}

function needsDimensionsInterrupt(answers, context = {}) {
  const effective = getEffectiveVehicle(answers);
  if (isRvVehicle(effective) && !isQuestionDone("rv_dimensions", answers, context) && !answers.rv_height) {
    return true;
  }
  if (isTruckVehicle(effective) && !isQuestionDone("truck_dimensions", answers, context) && !answers.truck_height) {
    return true;
  }
  return false;
}

/** Hard constraints that interrupt draft-first before generation. */
export function getNextHardConstraintQuestion(answers, context = {}) {
  if (!isQuestionDone("fuel_type", answers, context)) {
    const effective = getEffectiveVehicle(answers);
    if (
      isPersonalVehicle(effective)
      && (answers._customizeTrip || effective !== "Car")
    ) {
      return { done: false, ...FUEL_TYPE_QUESTION, interrupt: true };
    }
  }
  if (needsDimensionsInterrupt(answers, context)) {
    const effective = getEffectiveVehicle(answers);
    if (isRvVehicle(effective)) return { done: false, ...RV_DIMENSIONS_QUESTION, interrupt: true };
    if (isTruckVehicle(effective)) return { done: false, ...TRUCK_DIMENSIONS_QUESTION, interrupt: true };
  }
  if (needsEvChargingInterrupt(answers, context)) {
    return { done: false, ...EV_CHARGING_QUESTION, interrupt: true };
  }
  if (needsOvernightHardInterrupt(answers, context)) {
    return {
      done: false,
      ...buildOvernightPreferenceQuestion(context),
      interrupt: true,
    };
  }
  return null;
}

export function buildTripDraftQuestion(answers, context = {}) {
  const snapshot = formatRouteSnapshot(context);
  const pace = answers.stop_frequency || SMART_TRIP_DEFAULTS.stop_frequency;
  const stopLabel = deriveStopCountFromPace(pace, context);
  return {
    id: "trip_draft",
    type: "trip_draft",
    ask: snapshot ? `Your draft route (${snapshot})` : "Your draft route",
    hint: "We'll plan a comfortable drive with a few good stops. Change anything below if you want.",
    suggestedStopCount: stopLabel,
    pace,
    openCustomize: Boolean(answers._customizeTrip),
    quickChoices: DRAFT_QUICK_CHOICES,
    // Legacy accordion sections kept for any callers still reading tuneSections.
    tuneSections: getDraftTuneSections(answers, context),
  };
}

/** Three one-tap draft choices — plain language, no typing. */
export const DRAFT_QUICK_CHOICES = [
  {
    id: "party",
    ask: "Who's going?",
    options: [
      { id: "solo", label: "Just me", adults: 1, children: 0 },
      { id: "couple", label: "Two adults", adults: 2, children: 0 },
      { id: "family", label: "Family with kids", adults: 2, children: 2 },
    ],
  },
  {
    id: "pace",
    ask: "How do you like to drive?",
    options: [
      { id: "minimal", label: "Fewer stops", stop_frequency: "Minimal" },
      { id: "moderate", label: "A few stops", stop_frequency: "Moderate" },
      { id: "frequent", label: "Lots of stops", stop_frequency: "Frequent" },
    ],
  },
  {
    id: "spending",
    ask: "How do you like to spend?",
    options: [
      { id: "simple", label: "Keep it simple", luxury_level: "1" },
      { id: "comfortable", label: "Comfortable", luxury_level: "3" },
      { id: "treat", label: "Treat ourselves", luxury_level: "5" },
    ],
  },
];

export function resolveDraftQuickPartyId(answers = {}) {
  const adults = Number(answers.adult_count);
  const children = Number(answers.child_count);
  if (adults === 1 && children === 0) return "solo";
  if (adults === 2 && children >= 1) return "family";
  if (adults === 2 && children === 0) return "couple";
  if (adults >= 1 && children >= 1) return "family";
  if (adults === 1) return "solo";
  return "couple";
}

export function resolveDraftQuickPaceId(answers = {}) {
  const pace = answers.stop_frequency || SMART_TRIP_DEFAULTS.stop_frequency;
  if (pace === "Minimal") return "minimal";
  if (pace === "Frequent") return "frequent";
  return "moderate";
}

export function resolveDraftQuickSpendId(answers = {}) {
  const level = String(answers.luxury_level || SMART_TRIP_DEFAULTS.luxury_level);
  if (level === "1" || level === "2") return "simple";
  if (level === "4" || level === "5") return "treat";
  return "comfortable";
}

export function getDraftTuneSections(answers, context = {}) {
  return [
    { id: "party", label: "Party", question: PARTY_COMPOSITION_QUESTION },
    { id: "pace", label: "Trip pace", question: STOP_FREQUENCY_QUESTION },
    { id: "spending", label: "Spending", question: LUXURY_LEVEL_QUESTION },
    { id: "what_matters", label: "What matters", question: buildWhatMattersQuestion(answers, context) },
    { id: "constraints", label: "Constraints", question: buildTripDetailsQuestion(answers) },
  ];
}

const TRIP_NIGHTS_QUESTION = {
  id: "trip_nights",
  ask: "How many nights do you want to stop along the way?",
  hint: "We'll spread your overnight stops evenly on the route.",
  type: "choice",
  choices: ["1 night", "2 nights", "3 nights", "4+ nights", "Not sure yet"],
};

function needsPartyCompositionQuestion(answers, context = {}) {
  return !isQuestionDone("party_composition", answers, context)
    && (answers.adult_count == null || answers.child_count == null);
}

function needsTripNightsQuestion(answers, context) {
  if (answers.overnight_preference !== OVERNIGHT_PREFERENCE_OVERNIGHT) return false;
  if (!requiresMultipleDays(context)) return false;
  if (isContinuousDrive(answers)) return false;
  if (isDayTripByDistance(context)) return false;
  const effective = getEffectiveVehicle(answers);
  if (isRvVehicle(effective) || isTruckVehicle(effective)) return false;
  if (!needsPersonalOvernightBranch(answers)) return false;
  return !isAnswered("trip_nights", answers);
}

function needsPersonalPreferencesQuestion(answers, context) {
  // Legacy name — route prefs + stop interests are now the what_matters step.
  return needsWhatMattersQuestion(answers, context);
}

function needsRvTripNightsQuestion(answers, context) {
  if (!requiresMultipleDays(context)) return false;
  if (!isRvVehicle(getEffectiveVehicle(answers))) return false;
  if (needsWhatMattersQuestion(answers, context)) return false;
  return !isAnswered("trip_nights", answers);
}

function buildOvernightPreferenceQuestion(context) {
  const snapshot = formatRouteSnapshot(context);
  const ask = snapshot
    ? `This drive is about ${snapshot}. How do you want to tackle it?`
    : "This looks like a multi-day drive. How do you want to tackle it?";
  return {
    id: "overnight_preference",
    ask,
    routeSnapshot: snapshot,
    hint: "You can change this anytime before generating your trip.",
    mediumTripHint: isMediumLengthTrip(context)
      ? "Most people complete this drive in one day, but stopping overnight is always an option."
      : null,
    type: "choice",
    choices: [
      {
        value: OVERNIGHT_PREFERENCE_OVERNIGHT,
        label: "Stop overnight along the way",
        description: "We'll suggest places to stay and break the drive into days",
      },
      {
        value: OVERNIGHT_PREFERENCE_CONTINUOUS,
        label: "Drive straight through",
        description: "No hotels — just fuel and rest stops",
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
      ? `What kind of overnight stays work for you? (${snapshot})`
      : "What kind of overnight stays work for you?",
    hint: "Optional — add a hotel loyalty program below if you have one.",
    type: "lodging_stay",
    choices: LODGING_CHOICE_OPTIONS,
    loyaltyChoices: LOYALTY_CHOICES,
  };
}

const FOOD_ALLERGIES_QUESTION = {
  id: "food_allergies",
  ask: "Any food allergies we should watch for?",
  hint: "We'll steer restaurant picks away from these ingredients.",
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
  ask: "What ages are the kids traveling with you?",
  hint: "Helps us pick playgrounds, rest breaks, and kid-friendly stops.",
  type: "multiselect",
  choices: KIDS_AGE_CHOICES,
};

export const TRUCK_LODGING_CHOICES = [
  "Budget motel",
  "Mid-range hotel",
  "Any available",
];

export function buildTruckLodgingQuestion() {
  return {
    id: "lodging",
    ask: "What kind of motel or hotel works for your overnight stops?",
    hint: "We'll stick to truck-accessible spots near major stops.",
    type: "choice",
    choices: TRUCK_LODGING_CHOICES,
  };
}

export function isTruckLodgingInHistory(questionHistory = []) {
  return questionHistory.some(entry => entry.question?.id === "lodging");
}

/** Lodging tier assumed for no-sleeper trucks when the driver did not answer the lodging step. */
export function getAssumedTruckLodgingPill(answers, questionHistory = []) {
  if (!needsTruckExternalLodging(answers)) return null;
  if (isTruckLodgingInHistory(questionHistory)) return null;
  const lodging = answers?.lodging;
  if (!lodging || lodging === "No overnight stay" || lodging === "Sleeper cab — no hotel needed") return null;
  return { lodging };
}

const TRIP_BUDGET_FROM_LUXURY = {
  "1": "Under $200",
  "2": "$200 to $500",
  "3": "$500 to $1000",
  "4": "Over $1000",
  "5": "Over $1000",
};

/** Map spending stars to the legacy trip_budget label generation still understands. */
export function deriveTripBudgetFromLuxury(luxuryLevel) {
  return TRIP_BUDGET_FROM_LUXURY[String(luxuryLevel)] || "No budget limit";
}

const PERSONAL_ROUTE_PREF_CHOICES = [
  "Scenic route",
  "Avoid tolls",
  "Pet friendly",
  "Safe, well-lit stops only",
  "Fast food only",
  "Sit down restaurants only",
  "Avoid highways",
];

const RV_ROUTE_PREF_CHOICES = [
  "Full hookups at every stop",
  "Dry camping is fine",
  "Need dump stations",
  "Pet friendly",
  "Scenic route",
  "Avoid steep hills",
  "Propane refill stops",
];

function buildWhatMattersQuestion(answers, context) {
  const effective = getEffectiveVehicle(answers);
  const snapshot = formatRouteSnapshot(context);
  const ask = snapshot
    ? `What matters on this trip? (${snapshot})`
    : "What matters on this trip?";

  if (isThinTransportVehicle(effective)) {
    const withDest = needsThinTransportDestinationInterests(answers);
    return {
      id: "what_matters",
      ask,
      hint: withDest
        ? "Destination ideas and anything else worth planning around — all optional."
        : "Anything that should shape airport transfers and arrival plans — all optional.",
      type: "multiselect_group",
      sections: withDest
        ? [{ id: "stops_interests", label: "At your destination", choices: DESTINATION_INTEREST_CHOICES }]
        : [],
    };
  }

  if (isRvVehicle(effective)) {
    return {
      id: "what_matters",
      ask,
      hint: "Route needs and stop interests — pick anything that matters, or continue with defaults.",
      type: "multiselect_group",
      sections: [
        { id: "preferences", label: "Route & RV", choices: RV_ROUTE_PREF_CHOICES },
        { id: "stops_interests", label: "Stops & interests", choices: getStopsInterestsChoices(answers) },
      ],
    };
  }

  return {
    id: "what_matters",
    ask,
    hint: "Route preferences and stop interests — pick anything that matters, or continue with defaults.",
    type: "multiselect_group",
    sections: [
      { id: "preferences", label: "Route preferences", choices: PERSONAL_ROUTE_PREF_CHOICES },
      { id: "stops_interests", label: "Stops & interests", choices: getStopsInterestsChoices(answers) },
    ],
  };
}

function needsWhatMattersQuestion(answers, context = {}) {
  if (isQuestionDone("what_matters", answers, context)) return false;
  if (isAnswered("preferences", answers) && isAnswered("stops_interests", answers)) return false;
  const effective = getEffectiveVehicle(answers);
  if (isTruckVehicle(effective)) return false;
  if (isThinTransportVehicle(effective)) {
    return needsThinTransportDestinationInterests(answers) && !isAnswered("stops_interests", answers);
  }
  if (isPersonalVehicle(effective) || isRvVehicle(effective)) return true;
  return false;
}

function buildTripDetailsQuestion(answers) {
  const effective = getEffectiveVehicle(answers);
  const isTruck = isTruckVehicle(effective);
  return {
    id: "trip_details",
    pageTitle: "Any constraints?",
    pageSubtitle: isTruck
      ? "Optional — food, accessibility, and schedule. Expand a section only if it applies."
      : "Optional — food, accessibility, medical, and schedule. Expand a section only if it applies.",
    ask: "Anything we should plan around?",
    hint: "All optional — leave everything closed to continue with defaults.",
    type: "trip_details",
    layout: "constraints_panel",
    sections: [
      { id: "dietary", label: "Food & diet", choices: DIETARY_CHOICES, toggle: true },
      { id: "accessibility", label: "Accessibility & medical", choices: ACCESSIBILITY_CHOICES, toggle: true },
      { id: "schedule_restrictions", label: "Schedule", choices: getScheduleChoicesForContext(answers), toggle: true },
    ],
    inlineFollowups: {
      food_allergies: {
        whenSection: "dietary",
        whenValue: "Food Allergies — I will specify",
        placeholder: "List allergies…",
      },
      schedule_drive_hours: {
        whenSection: "schedule_restrictions",
        whenValues: ["Drive only during specific hours — I will specify", "Travel only during specific hours — I will specify"],
        placeholder: "e.g. 8am–6pm",
      },
    },
  };
}

function isThinTransportVehicle(vehicle) {
  return vehicle === "Plane" || isWaterVehicle(vehicle);
}

function needsThinTransportDestinationInterests(answers) {
  const effective = getEffectiveVehicle(answers);
  return effective === "Plane" || effective === "Ferry" || effective === "Boat";
}

function isThinTransportDetailsAnswered(answers) {
  return isAnswered("dietary", answers)
    && isAnswered("accessibility", answers)
    && isAnswered("schedule_restrictions", answers);
}

function buildThinTransportDetailsQuestion(answers) {
  return buildTripDetailsQuestion(answers);
}

function getNextThinTransportQuestions(answers, context = {}) {
  const partyKids = getNextPartyAndKidsFollowups(answers, context);
  if (partyKids) return partyKids;
  if (needsWhatMattersQuestion(answers, context)) {
    return { done: false, ...buildWhatMattersQuestion(answers, context) };
  }
  if (!isTripDetailsConfirmedInHistory(context) && !isThinTransportDetailsAnswered(answers)) {
    return { done: false, ...buildThinTransportDetailsQuestion(answers) };
  }
  const tail = getNextDetailFollowups(answers, context);
  if (tail) return tail;
  return null;
}

export const TRUCKER_QUESTION_SEQUENCE = [
  { id: "hauling_type", ask: "What are you hauling?", type: "choice", choices: ["General freight", "Refrigerated load", "Flatbed load", "Tanker load", "Empty / deadhead"] },
  { id: "sleeper_cab", ask: "Do you have a sleeper cab?", type: "choice", choices: ["Yes — I sleep in the cab", "No — I need a motel or hotel"] },
  { id: "truck_stop_brand", ask: "Any favorite truck stops?", type: "choice", choices: ["Pilot Flying J", "Love's", "Petro", "TA Travel Center", "No preference"] },
  { id: "route_restrictions", ask: "Any roads or states to avoid?", type: "multiselect", choices: ["Avoid toll roads", "Avoid certain states", "No restrictions"] },
];

const MULTI_VEHICLES_QUESTION = {
  id: "multi_vehicles",
  ask: "Which vehicles are traveling together?",
  hint: "Select every vehicle on this trip.",
  type: "multiselect",
  choices: MULTI_VEHICLE_CHOICES,
};

const COORDINATION_QUESTION = {
  id: "coordination_needs",
  ask: "How should everyone stay in sync?",
  hint: "Optional — skip if you're already aligned.",
  type: "multiselect",
  choices: [
    "Stay together the whole way",
    "Meet at waypoints",
    "Same hotels every night",
    "Separate overnight stops",
  ],
};

function isTripDetailsConfirmedInHistory(context = {}) {
  const history = context.questionHistory;
  if (!Array.isArray(history)) return false;
  return history.some(entry => entry.question?.id === "trip_details");
}

function isTripDetailsAnswered(answers, context = {}) {
  if (isTripDetailsConfirmedInHistory(context)) return true;
  return isAnswered("dietary", answers)
    && isAnswered("accessibility", answers)
    && isAnswered("schedule_restrictions", answers);
}

/** Latest entry per question id — defensive dedup for pill/sidebar rendering. */
export function dedupeQuestionHistoryById(questionHistory = []) {
  const order = [];
  const byId = new Map();
  for (const entry of questionHistory) {
    const id = entry.question?.id;
    if (!id) continue;
    if (!byId.has(id)) order.push(id);
    byId.set(id, entry);
  }
  return order.map(id => byId.get(id));
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

function isQuestionDone(id, answers, context = {}) {
  if (isAnswered(id, answers)) return true;
  const history = context?.questionHistory;
  if (!Array.isArray(history)) return false;
  return history.some(entry => entry.question?.id === id);
}

function needsOvernightPreferenceQuestion(answers, context) {
  const effective = getEffectiveVehicle(answers);
  if (isRvVehicle(effective) || isTruckVehicle(effective)) return false;
  if (answers.vehicle === MULTI_VEHICLE_TRIP && answers.primary_vehicle) {
    const primary = getEffectiveVehicle(answers);
    if (isRvVehicle(primary) || isTruckVehicle(primary)) return false;
  }
  if (!isRouteContextReady(context) && !context.routeFailed && !answers.route_context_unavailable) {
    return false;
  }
  if (answers.route_context_unavailable) return true;
  if (isDayTripByDistance(context)) return false;
  return requiresMultipleDays(context);
}

function needsPersonalOvernightBranch(answers) {
  const effective = getEffectiveVehicle(answers);
  if (isRvVehicle(effective) || isTruckVehicle(effective)) return false;
  if (answers.vehicle === MULTI_VEHICLE_TRIP && answers.primary_vehicle) {
    const primary = getEffectiveVehicle(answers);
    if (isRvVehicle(primary) || isTruckVehicle(primary)) return false;
  }
  return isPersonalVehicle(effective);
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
  if (isQuestionDone("overnight_preference", answers, context)) return null;
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
  if (needsTruckLodgingQuestion(answers, context) && !isQuestionDone("lodging", answers, context)) {
    return { done: false, ...buildTruckLodgingQuestion() };
  }
  return getNextTailQuestions(answers, context);
}

function buildVehicleQuestion() {
  return { done: false, id: "vehicle", ask: "How are you traveling?", type: "vehicle", groups: VEHICLE_GROUPS, choices: VEHICLE_CHOICES };
}

function buildRouteSetupQuestion() {
  return {
    done: false,
    id: "route_setup",
    ask: "Where are you headed?",
    hint: "Enter your start and destination — we'll map the drive and tailor every stop.",
    type: "route_setup",
  };
}

function hasRouteEndpoints(context = {}) {
  return Boolean(context?.origin?.trim() && context?.destination?.trim());
}

function buildPrimaryVehicleQuestion(selectedVehicles) {
  const choices = (Array.isArray(selectedVehicles) ? selectedVehicles : []).filter(Boolean);
  return {
    done: false,
    id: "primary_vehicle",
    ask: "Which vehicle is the main one for planning?",
    hint: "We'll plan around this vehicle first, then factor in the rest.",
    type: "choice",
    choices: choices.length ? choices : ["Car"],
  };
}

function getNextCommercialQuestion(answers, context = {}) {
  for (const q of TRUCKER_QUESTION_SEQUENCE) {
    if (!isQuestionDone(q.id, answers, context)) return { done: false, ...q };
  }
  return null;
}

function getNextPartyAndKidsFollowups(answers, context = {}) {
  if (needsPartyCompositionQuestion(answers) && !isQuestionDone("party_composition", answers, context)) {
    return { done: false, ...PARTY_COMPOSITION_QUESTION };
  }
  if (needsKidsAgesDetail(answers) && !isQuestionDone("kids_ages", answers, context)) {
    return { done: false, ...KIDS_AGES_QUESTION };
  }
  return null;
}

function getNextDetailFollowups(answers, context = {}) {
  if (needsFoodAllergyDetail(answers) && !isQuestionDone("food_allergies", answers, context)) {
    return { done: false, ...FOOD_ALLERGIES_QUESTION };
  }
  if (needsScheduleHoursDetail(answers) && !isQuestionDone("schedule_drive_hours", answers, context)) {
    return { done: false, ...buildScheduleDriveHoursQuestion(answers) };
  }
  return null;
}

function getNextTailQuestions(answers, context = {}) {
  if (!isTripDetailsAnswered(answers, context)) return { done: false, ...buildTripDetailsQuestion(answers) };
  return getNextDetailFollowups(answers, context);
}

function getNextPersonalBranchQuestion(answers, context) {
  if (!isQuestionDone("fuel_type", answers, context)) {
    const effective = getEffectiveVehicle(answers);
    // Smart defaults already chose Gasoline for Car; Customize / non-Car still ask fuel.
    const skipCarFuel = effective === "Car"
      && Boolean(answers._smartDefaultsApplied)
      && !answers._customizeTrip;
    if (!skipCarFuel) return { done: false, ...FUEL_TYPE_QUESTION };
  }
  if (needsTowingQuestion(answers, context) && !isQuestionDone("towing", answers, context)) {
    return { done: false, ...buildTowingQuestion(answers) };
  }
  const partyKids = getNextPartyAndKidsFollowups(answers, context);
  if (partyKids) return partyKids;
  if (needsStopFrequencyQuestion(answers, context)) return { done: false, ...STOP_FREQUENCY_QUESTION };
  if (needsLuxuryLevelQuestion(answers, context)) return { done: false, ...LUXURY_LEVEL_QUESTION };
  if (needsWhatMattersQuestion(answers, context)) {
    return { done: false, ...buildWhatMattersQuestion(answers, context) };
  }

  if (!isQuestionDone("overnight_preference", answers, context) && needsPersonalOvernightBranch(answers)) {
    if (shouldPendingOvernightRoute(answers, context) || needsOvernightPreferenceQuestion(answers, context)) {
      const overnightQ = buildOvernightPreferenceQuestion(context);
      if (shouldPendingOvernightRoute(answers, context)) {
        return { done: false, ...overnightQ, pendingRoute: true };
      }
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
  if (needsTripNightsQuestion(answers, context) && !isQuestionDone("trip_nights", answers, context)) {
    return { done: false, ...TRIP_NIGHTS_QUESTION };
  }
  if (needsLodgingQuestion(answers, context) && !isQuestionDone("lodging", answers, context)) {
    return { done: false, ...buildLodgingQuestion(context) };
  }

  const tail = getNextTailQuestions(answers, context);
  if (tail) return tail;
  return null;
}

function getNextRvBranchQuestion(answers, context) {
  if (!isQuestionDone("fuel_type", answers, context)) return { done: false, ...FUEL_TYPE_QUESTION };
  const partyKids = getNextPartyAndKidsFollowups(answers, context);
  if (partyKids) return partyKids;
  if (needsStopFrequencyQuestion(answers, context)) return { done: false, ...STOP_FREQUENCY_QUESTION };
  if (needsLuxuryLevelQuestion(answers, context)) return { done: false, ...LUXURY_LEVEL_QUESTION };
  if (needsWhatMattersQuestion(answers, context)) {
    return { done: false, ...buildWhatMattersQuestion(answers, context) };
  }
  if (needsRvTripNightsQuestion(answers, context) && !isQuestionDone("trip_nights", answers, context)) {
    return { done: false, ...TRIP_NIGHTS_QUESTION };
  }
  return getNextTailQuestions(answers, context);
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
 * - Plane/Boat/Ferry primary → thin transport mini-flow (party → what_matters → trip_details → follow-ups).
 * - RV primary → full RV branch (fuel → party → pace → spending → what_matters → trip_nights if multi-day → trip_details), then coordination.
 * - Truck primary → full truck branch (hauling → sleeper → truck stop → restrictions → lodging if no sleeper → trip_details), then coordination.
 * - Car/other personal primary → personal branch (may include overnight/lodging), then coordination.
 */
function guardMultiVehicleBranchNext(effective, branchNext, answers, context) {
  if (isRvVehicle(effective) || isTruckVehicle(effective)) {
    if (isPersonalOvernightOrLodgingQuestion(branchNext)) {
      if (isTruckVehicle(effective)) {
        const truckNext = getNextCommercialQuestion(answers, context);
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
    return getNextThinTransportQuestions(answers, context);
  }
  if (isTruckVehicle(effective)) {
    const truckNext = getNextCommercialQuestion(answers, context);
    if (truckNext) return truckNext;
    return getNextTruckBranchAfterCommercial(answers, context);
  }
  if (isRvVehicle(effective)) return getNextRvBranchQuestion(answers, context);
  if (isPersonalVehicle(effective)) return getNextPersonalBranchQuestion(answers, context);
  return null;
}

function getNextMultiVehicleQuestion(answers, context) {
  if (!isQuestionDone("multi_vehicles", answers, context)) return { done: false, ...MULTI_VEHICLES_QUESTION };
  if (!isQuestionDone("primary_vehicle", answers, context)) {
    return buildPrimaryVehicleQuestion(answers.multi_vehicles);
  }
  const effective = getEffectiveVehicle(answers);
  const branchNext = guardMultiVehicleBranchNext(
    effective,
    getNextBranchQuestion(effective, answers, context),
    answers,
    context,
  );
  if (branchNext) return branchNext;
  if (!isQuestionDone("coordination_needs", answers, context)) return { done: false, ...COORDINATION_QUESTION };
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
  if (out.sleeper_cab?.startsWith("Yes")) {
    out.lodging = "Sleeper cab — no hotel needed";
    delete out.lodging_auto_assigned;
  } else if (
    out.sleeper_cab?.includes("No")
    && out.overnight_preference === OVERNIGHT_PREFERENCE_OVERNIGHT
  ) {
    if (out.lodging) {
      delete out.lodging_auto_assigned;
    } else {
      out.lodging = "Mid-range hotel";
      out.lodging_auto_assigned = true;
    }
  } else {
    delete out.lodging_auto_assigned;
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

  if (out.adult_count != null && out.child_count != null) {
    out.travelers = deriveTravelersBand(out.adult_count, out.child_count);
  }

  if (out.stop_frequency) {
    out.stop_count = deriveStopCountFromPace(out.stop_frequency, context);
  }

  if (out.luxury_level && (out.trip_budget == null || out.trip_budget === "")) {
    out.trip_budget = deriveTripBudgetFromLuxury(out.luxury_level);
  }

  if (out.fuel_type && !isTruckVehicle(effective)) out.fuel = mapFuelTypeToFuel(out.fuel_type);
  if (out.ev_charging_network === "Tesla Superchargers") {
    out.fuel_type = "Electric — Tesla Superchargers";
    out.fuel = "Electric (EV)";
  } else if (out.ev_charging_network && /electric/i.test(String(out.fuel_type || ""))) {
    out.fuel = "Electric (EV)";
  }
  if (out.rv_dimensions && !out.rv_height) {
    if (out.rv_dimensions.startsWith("Under 10")) out.rv_height = "9'6\"";
    else if (out.rv_dimensions.startsWith("10")) out.rv_height = "10'6\"";
    else if (out.rv_dimensions.startsWith("11")) out.rv_height = "11'6\"";
    else out.rv_height = "12'6\"";
  }
  if (out.truck_dimensions && !out.truck_height) {
    if (out.truck_dimensions.includes("14")) out.truck_height = "14'0\"";
    else if (out.truck_dimensions.includes("Under")) out.truck_height = "12'6\"";
    else out.truck_height = "13'6\"";
  }
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
  if (!hasRouteEndpoints(context)) return buildRouteSetupQuestion();
  if (!answers?.vehicle) return buildVehicleQuestion();

  // Draft-first primary path (smart defaults from route setup). Sequential branches
  // remain for non-eligible vehicles. Hard constraints interrupt at Generate time.
  if (isDraftFirstEligible(answers)) {
    return buildTripDraftQuestion(answers, context);
  }

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

function applyDummyAnswer(sim, q) {
  if (!q || q.type === "loading") return;
  if (q.type === "trip_details") {
    sim.dietary = [];
    sim.accessibility = [];
    sim.schedule_restrictions = [];
    if (sim.trip_budget == null && sim.luxury_level) {
      sim.trip_budget = deriveTripBudgetFromLuxury(sim.luxury_level);
    } else if (sim.trip_budget == null) {
      sim.trip_budget = "No budget limit";
    }
    return;
  }
  if (q.type === "multiselect_group") {
    for (const sec of q.sections || []) {
      sim[sec.id] = [];
    }
    if (q.id === "what_matters") {
      if (sim.preferences == null) sim.preferences = [];
      if (sim.stops_interests == null) sim.stops_interests = [];
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
    sim.travelers = deriveTravelersBand(2, 1);
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

  const safeIndex = Math.max(0, phaseIndex);
  return {
    phases: FLOW_PHASES,
    currentPhaseId: phaseId,
    progressPercent,
    phaseLabel: FLOW_PHASES[safeIndex]?.label || FLOW_PHASES[0].label,
    stepIndex: safeIndex + 1,
    stepTotal: FLOW_PHASES.length,
  };
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

/** sparse = shrink panel to content; tall = scroll options, pin actions at bottom */
export function getPlanFlowLayoutClass(question, convoComplete = false) {
  if (convoComplete) return "sparse";
  if (!question) return "standard";
  // Route setup is a compact form, not an option list; keep it out of
  // standard-question overflow rules so the TO input cannot be clipped.
  if (question.id === "route_setup") return "sparse";
  if (question.id === "trip_draft" || question.type === "trip_draft") return "tall";
  const sparseIds = new Set(["party_composition", "sleeper_cab", "overnight_preference"]);
  if (sparseIds.has(question.id)) return "sparse";
  if (question.type === "party_composition") return "sparse";
  // Fixed-size preference pickers (7 options) fit above the dock — avoid tall flex chain collapse.
  if (question.id === "preferences") return "standard";
  if (question.type === "trip_details") return "tall";
  const tallTypes = new Set(["lodging_stay", "multiselect", "multiselect_group"]);
  if (tallTypes.has(question.type)) return "tall";
  if (question.type === "choice" && Array.isArray(question.choices) && question.choices.length <= 2 && !question.pendingRoute) {
    return "sparse";
  }
  return "standard";
}
