import {
  isTruckVehicle,
  isRvVehicle,
  isWaterVehicle,
  applyAssumedVehicleSpecs,
  getEffectiveVehicle,
  MULTI_VEHICLE_TRIP,
} from "./vehicles.js";
import { parseMilesFromDistance } from "./parsing.js";

export { MULTI_VEHICLE_TRIP };

export const MARINE_SKIP_MESSAGE =
  "Marine routing is approximate — Google Maps does not support water navigation. Showing departure and arrival port recommendations only.";
export const PLANE_SKIP_MESSAGE =
  "Showing airport transport, layover recommendations, and destination activity suggestions only.";

export const FLOW_QUESTION_IDS = [
  "vehicle",
  "fuel_type",
  "multi_vehicles",
  "primary_vehicle",
  "travelers",
  "special_needs",
  "lodging",
  "preferences",
  "hauling_type",
  "sleeper_cab",
  "truck_stop_brand",
  "route_restrictions",
  "coordination_needs",
];

export const VEHICLE_GROUPS = [
  {
    label: "Personal",
    options: [
      { value: "Car", label: "Car" },
      { value: "Motorcycle", label: "Motorcycle" },
      { value: "SUV or Van", label: "SUV or Van" },
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

/** @deprecated Kept for imports — specs are assumed automatically. */
export const TRUCK_HEIGHTS = [];
export const RV_HEIGHTS = [];
export const TRUCK_WEIGHTS = [];
export const RV_WEIGHTS = [];

export const KIDS_AGE_CHOICES = [];

const DAY_TRIP_MILES = 150;
const PERSONAL_MAX_QUESTIONS = 5;

const PERSONAL_VEHICLES = ["Car", "Motorcycle", "SUV or Van"];

const FUEL_TYPE_PERSONAL = {
  id: "fuel_type",
  ask: "What fuel does your vehicle take?",
  type: "choice",
  choices: ["Gasoline", "Diesel", "Electric", "Hybrid"],
};

const FUEL_TYPE_RV = {
  id: "fuel_type",
  ask: "What fuel does your vehicle take?",
  type: "choice",
  choices: ["Gasoline", "Diesel", "Propane"],
};

const TRAVELERS_QUESTION = {
  id: "travelers",
  ask: "Who is traveling?",
  type: "travelers",
  choices: ["Solo", "Couple", "Family with young kids", "Group of friends"],
};

const SPECIAL_NEEDS_QUESTION = {
  id: "special_needs",
  ask: "Any special needs?",
  type: "multiselect",
  choices: [
    "Frequent rest stops needed",
    "Kid friendly restaurants",
    "Diaper changing stations",
  ],
};

const LODGING_QUESTION = {
  id: "lodging",
  ask: "Where do you want to sleep?",
  type: "choice",
  choices: ["Hotel", "Motel", "Airbnb", "Camping", "Doesn't matter"],
};

const PERSONAL_PREFERENCES_QUESTION = {
  id: "preferences",
  ask: "Any preferences?",
  type: "multiselect",
  choices: [
    "Scenic route",
    "Avoid tolls",
    "Pet friendly",
    "Fast food only",
    "Sit down restaurants only",
    "Avoid highways",
  ],
};

const RV_PREFERENCES_QUESTION = {
  id: "preferences",
  ask: "Any preferences?",
  type: "multiselect",
  choices: [
    "Full hookups only",
    "Dry camping ok",
    "Need dump stations",
    "Pet friendly",
    "Scenic route",
    "Avoid steep grades",
    "Propane refill stops",
  ],
};

export const TRUCKER_QUESTION_SEQUENCE = [
  {
    id: "hauling_type",
    ask: "What are you hauling?",
    type: "choice",
    choices: ["General freight", "Refrigerated load", "Flatbed load", "Tanker load", "Empty"],
  },
  {
    id: "sleeper_cab",
    ask: "Do you have a sleeper cab?",
    type: "choice",
    choices: ["Yes I have a sleeper cab", "No I need a motel or hotel"],
  },
  {
    id: "truck_stop_brand",
    ask: "Preferred truck stop?",
    type: "choice",
    choices: ["Pilot Flying J", "Love's", "Petro", "TA Travel Center", "No preference"],
  },
  {
    id: "route_restrictions",
    ask: "Any route restrictions?",
    type: "multiselect",
    choices: ["Avoid toll roads", "Avoid certain states", "No restrictions"],
  },
];

const MULTI_VEHICLES_QUESTION = {
  id: "multi_vehicles",
  ask: "Which vehicles are on this trip?",
  type: "multiselect",
  choices: MULTI_VEHICLE_CHOICES,
};

const COORDINATION_QUESTION = {
  id: "coordination_needs",
  ask: "Any coordination needs?",
  type: "multiselect",
  choices: [
    "Meet at waypoints",
    "Same hotels throughout",
    "Convoy mode",
    "Separate overnight stops",
  ],
};

export function hasKidsToddlers(specialNeeds) {
  const needs = Array.isArray(specialNeeds) ? specialNeeds : [];
  return needs.includes("Diaper changing stations");
}

export function getRouteDistanceMiles(context) {
  if (context?.routeDistanceMiles != null) return context.routeDistanceMiles;
  return parseMilesFromDistance(context?.routeDistance);
}

export function isDayTripByDistance(context) {
  const miles = getRouteDistanceMiles(context);
  return miles != null && miles < DAY_TRIP_MILES;
}

function isPersonalVehicle(vehicle) {
  return PERSONAL_VEHICLES.includes(vehicle);
}

function isInstantCompleteVehicle(vehicle) {
  return isWaterVehicle(vehicle) || vehicle === "Plane";
}

function isAnswered(id, answers) {
  if (answers[id] === undefined) return false;
  if (Array.isArray(answers[id])) return true;
  return answers[id] !== "";
}

function needsSpecialNeedsQuestion(answers) {
  return answers.travelers === "Family with young kids";
}

function needsLodgingQuestion(answers, context) {
  if (isDayTripByDistance(context)) return false;
  const effective = getEffectiveVehicle(answers);
  if (isRvVehicle(effective) || isTruckVehicle(effective)) return false;
  return isPersonalVehicle(effective);
}

function countPersonalFlowQuestions(answers, context) {
  let n = 1;
  if (isAnswered("fuel_type", answers)) n += 1;
  if (isAnswered("travelers", answers)) n += 1;
  if (needsSpecialNeedsQuestion(answers) && isAnswered("special_needs", answers)) n += 1;
  if (needsLodgingQuestion(answers, context) && isAnswered("lodging", answers)) n += 1;
  if (isAnswered("preferences", answers)) n += 1;
  return n;
}

function buildVehicleQuestion() {
  return {
    done: false,
    id: "vehicle",
    ask: "What kind of vehicle are you driving?",
    type: "vehicle",
    groups: VEHICLE_GROUPS,
    choices: VEHICLE_CHOICES,
  };
}

function buildPrimaryVehicleQuestion(selectedVehicles) {
  const choices = (Array.isArray(selectedVehicles) ? selectedVehicles : []).filter(Boolean);
  return {
    done: false,
    id: "primary_vehicle",
    ask: "What is the primary vehicle?",
    type: "choice",
    choices: choices.length ? choices : ["Car"],
  };
}

function getNextCommercialQuestion(answers) {
  for (const q of TRUCKER_QUESTION_SEQUENCE) {
    if (!isAnswered(q.id, answers)) return { done: false, ...q };
  }
  return null;
}

function getNextPersonalBranchQuestion(answers, context) {
  if (!canAskPersonalQuestion(answers, context)) return null;

  if (!isAnswered("fuel_type", answers)) return { done: false, ...FUEL_TYPE_PERSONAL };
  if (!isAnswered("travelers", answers)) return { done: false, ...TRAVELERS_QUESTION };

  if (needsSpecialNeedsQuestion(answers) && !isAnswered("special_needs", answers)) {
    return { done: false, ...SPECIAL_NEEDS_QUESTION };
  }

  if (needsLodgingQuestion(answers, context) && !isAnswered("lodging", answers)) {
    if (countPersonalFlowQuestions(answers, context) < PERSONAL_MAX_QUESTIONS) {
      return { done: false, ...LODGING_QUESTION };
    }
  }

  if (!isAnswered("preferences", answers) && countPersonalFlowQuestions(answers, context) < PERSONAL_MAX_QUESTIONS) {
    return { done: false, ...PERSONAL_PREFERENCES_QUESTION };
  }

  return null;
}

function getNextRvBranchQuestion(answers, context) {
  if (!isAnswered("fuel_type", answers)) return { done: false, ...FUEL_TYPE_RV };
  if (!isAnswered("travelers", answers)) return { done: false, ...TRAVELERS_QUESTION };

  if (needsSpecialNeedsQuestion(answers) && !isAnswered("special_needs", answers)) {
    return { done: false, ...SPECIAL_NEEDS_QUESTION };
  }

  if (!isAnswered("preferences", answers)) return { done: false, ...RV_PREFERENCES_QUESTION };
  return null;
}

function getNextBranchQuestion(effective, answers, context) {
  if (isInstantCompleteVehicle(effective)) return null;
  if (isTruckVehicle(effective)) return getNextCommercialQuestion(answers);
  if (isRvVehicle(effective)) return getNextRvBranchQuestion(answers, context);
  if (isPersonalVehicle(effective)) return getNextPersonalBranchQuestion(answers, context);
  return null;
}

function getNextMultiVehicleQuestion(answers, context) {
  if (!isAnswered("multi_vehicles", answers)) {
    return { done: false, ...MULTI_VEHICLES_QUESTION };
  }
  if (!answers.primary_vehicle) {
    return buildPrimaryVehicleQuestion(answers.multi_vehicles);
  }

  const effective = getEffectiveVehicle(answers);
  const branchNext = getNextBranchQuestion(effective, answers, context);
  if (branchNext) return branchNext;

  if (!isAnswered("coordination_needs", answers)) {
    return { done: false, ...COORDINATION_QUESTION };
  }
  return null;
}

function mapFuelTypeToFuel(fuelType) {
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
  } else if (out.sleeper_cab?.startsWith("No")) {
    out.lodging = "Motel near truck stop";
  }

  if (out.truck_stop_brand && out.truck_stop_brand !== "No preference") {
    out.truck_stop_preference = out.truck_stop_brand;
  }

  if (out.hauling_type === "Tanker load" && out.truck_hazmat === "No") {
    out.hauling_note = "Tanker load — verify hazmat requirements if applicable";
  }

  return out;
}

export function normalizeTripAnswers(answers, context = {}) {
  const vehicle = answers.vehicle || "Car";
  const effective = getEffectiveVehicle(answers);
  let out = applyAssumedVehicleSpecs({ ...answers, vehicle: effective });
  out.vehicle = vehicle;
  out.effective_vehicle = effective;

  const miles = getRouteDistanceMiles(context);
  if (miles != null) {
    out.trip_type = miles < DAY_TRIP_MILES ? "Day trip" : (out.trip_type || "Road trip");
  } else if (!out.trip_type) {
    out.trip_type = "Road trip";
  }

  if (!Array.isArray(out.preferences)) {
    out.preferences = out.preferences ? [out.preferences] : [];
  }
  if (!Array.isArray(out.special_needs)) {
    out.special_needs = out.special_needs ? [out.special_needs] : [];
  }
  if (!Array.isArray(out.route_restrictions) && out.route_restrictions != null) {
    out.route_restrictions = [out.route_restrictions];
  }
  if (!Array.isArray(out.coordination_needs) && out.coordination_needs != null) {
    out.coordination_needs = [out.coordination_needs];
  }

  if (out.fuel_type && !isTruckVehicle(effective)) {
    out.fuel = mapFuelTypeToFuel(out.fuel_type);
  }

  if (isTruckVehicle(effective)) {
    out.hos_compliance = true;
    out.truck_height = "13'6\"";
    out.truck_weight = "80,000 lbs";
    out.fuel = "Diesel";
    out.fuel_type = "Diesel";
    out = mapTruckerAnswers(out);
  }

  if (isRvVehicle(effective)) {
    out.lodging = "RV parks and campgrounds";
  }

  if (isDayTripByDistance(context)) {
    delete out.lodging;
    out.trip_type = "Day trip";
  }

  if (vehicle === "Plane") out.trip_type = "Flying";
  if (isWaterVehicle(vehicle)) out.trip_type = "Ferry or Cruise";

  return out;
}

export function getFlowCompleteMessage(answers) {
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
  return null;
}

export function getNextFlowQuestion(answers, context = {}) {
  const normalized = normalizeTripAnswers(answers, context);

  if (!normalized.vehicle) return buildVehicleQuestion();

  if (normalized.vehicle === MULTI_VEHICLE_TRIP) {
    const multiNext = getNextMultiVehicleQuestion(normalized, context);
    if (multiNext) return multiNext;
    return { done: true, skipMessage: getFlowCompleteMessage(normalized) };
  }

  if (isWaterVehicle(normalized.vehicle)) {
    return { done: true, skipMessage: MARINE_SKIP_MESSAGE };
  }
  if (normalized.vehicle === "Plane") {
    return { done: true, skipMessage: PLANE_SKIP_MESSAGE };
  }

  const effective = getEffectiveVehicle(normalized);
  const branchNext = getNextBranchQuestion(effective, normalized, context);
  if (branchNext) return branchNext;

  return { done: true };
}

export function fetchNextQuestion(answers, context = {}) {
  return getNextFlowQuestion(answers, context);
}

export function countFlowQuestionsAnswered(answers) {
  let n = 0;
  if (answers.vehicle) n += 1;
  const effective = getEffectiveVehicle(answers);
  if (answers.vehicle === MULTI_VEHICLE_TRIP) {
    if (isAnswered("multi_vehicles", answers)) n += 1;
    if (answers.primary_vehicle) n += 1;
    if (isAnswered("coordination_needs", answers)) n += 1;
  }
  if (isTruckVehicle(effective)) {
    TRUCKER_QUESTION_SEQUENCE.forEach(q => {
      if (isAnswered(q.id, answers)) n += 1;
    });
    return n;
  }
  if (isPersonalVehicle(effective) || isRvVehicle(effective)) {
    if (isAnswered("fuel_type", answers)) n += 1;
    if (isAnswered("travelers", answers)) n += 1;
    if (needsSpecialNeedsQuestion(answers) && isAnswered("special_needs", answers)) n += 1;
    if (isAnswered("lodging", answers)) n += 1;
    if (isAnswered("preferences", answers)) n += 1;
  }
  return n;
}

export function pruneSkippedAnswers(answers) {
  return normalizeTripAnswers(answers);
}

export function flowQuestionSkipped() {
  return false;
}

export function countApplicableFlowQuestions() {
  return 8;
}

export function isFlowQuestionComplete(id, answers) {
  if (id === "vehicle") return !!answers.vehicle;
  const effective = getEffectiveVehicle(answers);
  if (isTruckVehicle(effective)) return isAnswered(id, answers);
  return isAnswered(id, answers);
}

export function buildFlowQuestion(id, answers, context = {}) {
  if (id === "vehicle") return buildVehicleQuestion();
  return getNextFlowQuestion(answers, context);
}
