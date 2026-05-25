import {
  isTruckVehicle,
  isRvVehicle,
  isWaterVehicle,
  applyAssumedVehicleSpecs,
  getEffectiveVehicle,
  MULTI_VEHICLE_TRIP,
} from "./vehicles.js";
import { parseMilesFromDistance } from "./parsing.js";
import {
  isPersonalVehicle,
  FUEL_TYPE_CHOICES,
  TOWING_CHOICES,
  DIETARY_CHOICES,
  ACCESSIBILITY_CHOICES,
  TRIP_BUDGET_CHOICES,
  SCHEDULE_CHOICES,
  LOYALTY_CHOICES,
  getStopsInterestsChoices,
  needsFoodAllergyDetail,
  needsScheduleHours,
  needsTowingQuestion,
  isTowingSelected,
} from "./tripAccommodations.js";

export { MULTI_VEHICLE_TRIP };

export const MARINE_SKIP_MESSAGE =
  "Marine routing is approximate — Google Maps does not support water navigation. Showing departure and arrival port recommendations only.";
export const PLANE_SKIP_MESSAGE =
  "Showing airport transport, layover recommendations, and destination activity suggestions only.";

export const FLOW_QUESTION_IDS = [
  "vehicle", "fuel_type", "towing", "multi_vehicles", "primary_vehicle", "travelers",
  "lodging", "loyalty_program", "dietary", "food_allergies", "accessibility",
  "stops_interests", "trip_budget", "schedule_restrictions", "schedule_hours", "preferences",
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

export const LODGING_CHOICE_OPTIONS = [
  { value: "Budget", label: "Budget — 1 to 2 star hotels and motels under $80 per night" },
  { value: "Mid-Range", label: "Mid-Range — 3 star hotels between $80 and $150 per night" },
  { value: "Luxury", label: "Luxury — 4 to 5 star hotels over $150 per night" },
  { value: "Airbnb or Vacation Rental", label: "Airbnb or Vacation Rental" },
  { value: "Camping or Outdoors", label: "Camping or Outdoors" },
  { value: "Doesn't Matter", label: "Doesn't Matter" },
];

const FUEL_TYPE_QUESTION = {
  id: "fuel_type",
  ask: "What kind of fuel does your vehicle take?",
  type: "choice",
  choices: FUEL_TYPE_CHOICES,
};

const TOWING_QUESTION = {
  id: "towing",
  ask: "Are you towing anything?",
  type: "choice",
  choices: TOWING_CHOICES,
};

const TRAVELERS_QUESTION = {
  id: "travelers",
  ask: "How many travelers?",
  type: "travelers",
  choices: ["1", "2", "3 to 5", "6 or more"],
};

const LODGING_QUESTION = {
  id: "lodging",
  ask: "What kind of lodging do you prefer?",
  type: "lodging",
  choices: LODGING_CHOICE_OPTIONS,
};

const LOYALTY_QUESTION = {
  id: "loyalty_program",
  ask: "Hotel loyalty program preference?",
  type: "choice",
  choices: LOYALTY_CHOICES,
};

const DIETARY_QUESTION = {
  id: "dietary",
  ask: "Any dietary preferences or restrictions?",
  type: "multiselect",
  choices: DIETARY_CHOICES,
};

const FOOD_ALLERGIES_QUESTION = {
  id: "food_allergies",
  ask: "Please specify your food allergies:",
  type: "text",
  placeholder: "e.g. peanuts, shellfish, dairy…",
};

const ACCESSIBILITY_QUESTION = {
  id: "accessibility",
  ask: "Any accessibility needs?",
  type: "multiselect",
  choices: ACCESSIBILITY_CHOICES,
};

const TRIP_BUDGET_QUESTION = {
  id: "trip_budget",
  ask: "Do you have a total trip budget?",
  type: "choice",
  choices: TRIP_BUDGET_CHOICES,
};

const SCHEDULE_QUESTION = {
  id: "schedule_restrictions",
  ask: "Any schedule restrictions?",
  type: "choice",
  choices: SCHEDULE_CHOICES,
};

const SCHEDULE_HOURS_QUESTION = {
  id: "schedule_hours",
  ask: "What hours do you prefer to drive?",
  type: "text",
  placeholder: "e.g. 8 AM – 6 PM only",
};

const PERSONAL_PREFERENCES_QUESTION = {
  id: "preferences",
  ask: "Any route preferences?",
  type: "multiselect",
  choices: ["Scenic route", "Avoid tolls", "Pet friendly", "Fast food only", "Sit down restaurants only", "Avoid highways"],
};

const RV_PREFERENCES_QUESTION = {
  id: "preferences",
  ask: "Any route preferences?",
  type: "multiselect",
  choices: ["Full hookups only", "Dry camping ok", "Need dump stations", "Pet friendly", "Scenic route", "Avoid steep grades", "Propane refill stops"],
};

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
  ask: "Any coordination needs?",
  type: "multiselect",
  choices: ["Meet at waypoints", "Same hotels throughout", "Convoy mode", "Separate overnight stops"],
};

function buildStopsInterestsQuestion(answers) {
  return {
    id: "stops_interests",
    ask: "Any specific stops or interests?",
    type: "multiselect",
    choices: getStopsInterestsChoices(answers),
  };
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

function needsLodgingQuestion(answers, context) {
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
  if (!isAnswered("schedule_restrictions", answers)) return { done: false, ...SCHEDULE_QUESTION };
  if (needsScheduleHours(answers) && !isAnswered("schedule_hours", answers)) {
    return { done: false, ...SCHEDULE_HOURS_QUESTION };
  }
  return null;
}

function getNextNonCommercialQuestions(answers, context) {
  if (!isAnswered("dietary", answers)) return { done: false, ...DIETARY_QUESTION };
  if (needsFoodAllergyDetail(answers) && !isAnswered("food_allergies", answers)) {
    return { done: false, ...FOOD_ALLERGIES_QUESTION };
  }
  if (!isAnswered("accessibility", answers)) return { done: false, ...ACCESSIBILITY_QUESTION };
  if (!isAnswered("stops_interests", answers)) return { done: false, ...buildStopsInterestsQuestion(answers) };
  if (!isAnswered("trip_budget", answers)) return { done: false, ...TRIP_BUDGET_QUESTION };
  if (!isAnswered("schedule_restrictions", answers)) return { done: false, ...SCHEDULE_QUESTION };
  if (needsScheduleHours(answers) && !isAnswered("schedule_hours", answers)) {
    return { done: false, ...SCHEDULE_HOURS_QUESTION };
  }
  return null;
}

function getNextPersonalBranchQuestion(answers, context) {
  if (!isAnswered("fuel_type", answers)) return { done: false, ...FUEL_TYPE_QUESTION };
  if (needsTowingQuestion(answers) && !isAnswered("towing", answers)) return { done: false, ...TOWING_QUESTION };
  if (!isAnswered("travelers", answers)) return { done: false, ...TRAVELERS_QUESTION };
  if (needsLodgingQuestion(answers, context) && !isAnswered("lodging", answers)) return { done: false, ...LODGING_QUESTION };
  if (needsLodgingQuestion(answers, context) && !isAnswered("loyalty_program", answers)) return { done: false, ...LOYALTY_QUESTION };
  const shared = getNextNonCommercialQuestions(answers, context);
  if (shared) return shared;
  if (!isAnswered("preferences", answers)) return { done: false, ...PERSONAL_PREFERENCES_QUESTION };
  return null;
}

function getNextRvBranchQuestion(answers, context) {
  if (!isAnswered("fuel_type", answers)) return { done: false, ...FUEL_TYPE_QUESTION };
  if (!isAnswered("travelers", answers)) return { done: false, ...TRAVELERS_QUESTION };
  const shared = getNextNonCommercialQuestions(answers, context);
  if (shared) return shared;
  if (!isAnswered("preferences", answers)) return { done: false, ...RV_PREFERENCES_QUESTION };
  return null;
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

export function normalizeTripAnswers(answers, context = {}) {
  const vehicle = answers.vehicle || "Car";
  const effective = getEffectiveVehicle(answers);
  let out = applyAssumedVehicleSpecs({ ...answers, vehicle: effective });
  out.vehicle = vehicle;
  out.effective_vehicle = effective;

  const miles = getRouteDistanceMiles(context);
  if (miles != null) out.trip_type = miles < DAY_TRIP_MILES ? "Day trip" : (out.trip_type || "Road trip");
  else if (!out.trip_type) out.trip_type = "Road trip";

  ["preferences", "dietary", "accessibility", "stops_interests", "route_restrictions", "coordination_needs"].forEach(k => {
    if (!Array.isArray(out[k])) out[k] = out[k] ? [out[k]] : [];
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
  if (!answers?.vehicle) return buildVehicleQuestion();
  const normalized = normalizeTripAnswers(answers, context);

  if (normalized.vehicle === MULTI_VEHICLE_TRIP) {
    const multiNext = getNextMultiVehicleQuestion(normalized, context);
    if (multiNext) return multiNext;
    return { done: true, skipMessage: getFlowCompleteMessage(normalized) };
  }
  if (isWaterVehicle(normalized.vehicle)) return { done: true, skipMessage: MARINE_SKIP_MESSAGE };
  if (normalized.vehicle === "Plane") return { done: true, skipMessage: PLANE_SKIP_MESSAGE };

  const branchNext = getNextBranchQuestion(getEffectiveVehicle(normalized), normalized, context);
  if (branchNext) return branchNext;
  return { done: true };
}

export function fetchNextQuestion(answers, context = {}) {
  return getNextFlowQuestion(answers, context);
}

export function countFlowQuestionsAnswered(answers) {
  return FLOW_QUESTION_IDS.filter(id => isAnswered(id, answers)).length;
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
