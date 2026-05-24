import {
  isTruckVehicle,
  isRvVehicle,
  isRvTrip,
  isTruckerTrip,
  hasFamilyKids,
  skipLodgingQuestion,
  skipTravelersQuestion,
  skipPreferencesQuestion,
} from "./vehicles.js";

export const FLOW_QUESTION_IDS = ["trip_type", "vehicle", "travelers", "lodging", "preferences"];

export const TRIP_TYPE_CHOICES = [
  "Road trip", "Day trip", "Driving home", "Work or Delivery run",
  "Flying", "Ferry or Cruise", "Multi-leg trip",
];

export const VEHICLE_CHOICES = [
  "Car", "SUV", "Pickup Truck", "Motorcycle", "RV", "Camper Van",
  "Semi Truck (18-wheeler)", "Box Truck", "Flatbed", "Tanker",
  "Boat", "Ferry", "Plane",
];

export const PREFS_RV = [
  "Scenic route", "Low bridge warnings", "RV park availability", "Dump station locations",
  "Propane refill locations", "High clearance fuel stops", "Avoid steep grades",
  "Pet-friendly stops", "Kid-friendly stops", "Avoid tolls", "Avoid highways",
];

export const TRAVELER_CHOICES = ["Solo", "Partner", "Family with kids", "Group of friends", "Team", "Passengers"];
export const KIDS_AGE_CHOICES = ["Toddlers", "Young kids", "Tweens", "Teens", "Mix of ages"];

export const LODGING_REGULAR = [
  "Budget hotel", "Mid-range hotel", "Upscale hotel", "Luxury hotel",
  "Campground", "Airbnb", "No overnight stay",
];

export const LODGING_TRUCKER = [
  "Truck stop (Pilot/Flying J/Love's)",
  "Motel near truck stop",
  "Sleeper cab — no hotel needed",
  "Rest area",
  "Weigh station area",
];

export const PREFS_REGULAR = [
  "Scenic route", "Restaurant recommendations", "Grocery delivery to hotel",
  "Pet-friendly stops", "Kid-friendly stops", "Avoid tolls", "Avoid highways",
  "EV charging stops",
];

export const PREFS_TRUCKER = [
  "Weigh station locations", "Truck parking availability",
  "Fuel stops (Pilot/Flying J/Love's/TA)", "Scale bypass PrePass",
  "Low bridge warnings", "Hazmat route", "Rest area locations", "Avoid steep grades",
];

export const TRUCK_HEIGHTS = (() => {
  const opts = [];
  for (let inches = 120; inches <= 168; inches += 6) {
    const ft = Math.floor(inches / 12);
    const rem = inches % 12;
    opts.push(rem ? `${ft}'${rem}"` : `${ft}'0"`);
  }
  return opts;
})();

export const RV_HEIGHTS = (() => {
  const opts = [];
  for (let inches = 96; inches <= 162; inches += 6) {
    const ft = Math.floor(inches / 12);
    const rem = inches % 12;
    opts.push(rem ? `${ft}'${rem}"` : `${ft}'0"`);
  }
  return opts;
})();

export const RV_WEIGHTS = (() => {
  const opts = [];
  for (let w = 5000; w <= 26000; w += 1000) opts.push(`${w.toLocaleString()} lbs`);
  return opts;
})();

export const TRUCK_WEIGHTS = (() => {
  const opts = [];
  for (let w = 20000; w <= 80000; w += 5000) opts.push(`${w.toLocaleString()} lbs`);
  return opts;
})();

export function hasKidsToddlers(kidsAges) {
  return kidsAges === "Toddlers" || kidsAges === "Mix of ages";
}

export function flowQuestionSkipped(id, answers) {
  if (id === "travelers") return skipTravelersQuestion(answers.trip_type, answers.vehicle);
  if (id === "lodging") return skipLodgingQuestion(answers.trip_type, answers.vehicle);
  if (id === "preferences") return skipPreferencesQuestion(answers.trip_type, answers.vehicle);
  return false;
}

export function pruneSkippedAnswers(answers) {
  const pruned = { ...answers };
  for (const id of FLOW_QUESTION_IDS) {
    if (!flowQuestionSkipped(id, pruned)) continue;
    delete pruned[id];
    if (id === "vehicle") {
      delete pruned.truck_height;
      delete pruned.truck_weight;
      delete pruned.truck_hazmat;
      delete pruned.rv_height;
      delete pruned.rv_weight;
      delete pruned.rv_towing;
    }
    if (id === "travelers") delete pruned.kids_ages;
    if (id === "preferences") delete pruned.preferences;
  }
  return pruned;
}

export function countApplicableFlowQuestions(answers) {
  return FLOW_QUESTION_IDS.filter(id => !flowQuestionSkipped(id, answers)).length;
}

export function isFlowQuestionComplete(id, answers) {
  if (answers[id] === undefined) return false;
  if (id === "vehicle" && isTruckVehicle(answers.vehicle)) {
    return !!(answers.truck_height && answers.truck_weight && answers.truck_hazmat);
  }
  if (id === "vehicle" && isRvVehicle(answers.vehicle)) {
    return !!(answers.rv_height && answers.rv_weight && answers.rv_towing);
  }
  if (id === "travelers" && hasFamilyKids(answers.travelers)) {
    return !!answers.kids_ages;
  }
  return true;
}

export function buildFlowQuestion(id, answers) {
  const base = { done: false, id };
  const prefChoices = isTruckerTrip(answers) ? PREFS_TRUCKER : isRvTrip(answers) ? PREFS_RV : PREFS_REGULAR;
  switch (id) {
    case "trip_type":
      return { ...base, ask: "What kind of trip is this?", type: "choice", choices: TRIP_TYPE_CHOICES };
    case "vehicle":
      return { ...base, ask: "What are you traveling in?", type: "vehicle", choices: VEHICLE_CHOICES };
    case "travelers":
      return { ...base, ask: "Who's coming along?", type: "travelers", choices: TRAVELER_CHOICES };
    case "lodging":
      return {
        ...base, ask: "Where do you want to stay?", type: "choice",
        choices: isTruckerTrip(answers) ? LODGING_TRUCKER : LODGING_REGULAR,
      };
    case "preferences":
      return {
        ...base, ask: "Any preferences? Select all that apply.", type: "multiselect",
        choices: prefChoices,
      };
    default:
      return null;
  }
}

export function getNextFlowQuestion(answers) {
  for (const id of FLOW_QUESTION_IDS) {
    if (flowQuestionSkipped(id, answers)) continue;
    if (!isFlowQuestionComplete(id, answers)) {
      const q = buildFlowQuestion(id, answers);
      if (q) return q;
    }
  }
  return { done: true };
}

export function countFlowQuestionsAnswered(answers) {
  let n = 0;
  for (const id of FLOW_QUESTION_IDS) {
    if (flowQuestionSkipped(id, answers)) continue;
    if (isFlowQuestionComplete(id, answers)) n += 1;
  }
  return n;
}

export async function fetchNextQuestion(answers) {
  const local = getNextFlowQuestion(answers);
  if (local.done) return { done: true };
  return local;
}
