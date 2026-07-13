/** Shared constants and helpers for human-possibility accommodations. */
import { getEffectiveVehicle, isTruckVehicle, isRvVehicle, isWaterVehicle, parseTravelerCount } from "./vehicles.js";
import { parseMilesFromDistance } from "./parsing.js";

export const FUEL_TYPE_CHOICES = [
  "Gasoline",
  "Diesel",
  "Electric",
  "Hybrid",
];

export const TOWING_CHOICES = [
  "No",
  "Yes — small trailer",
  "Yes — large trailer",
  "Yes — boat trailer",
];

export const DIETARY_CHOICES = [
  "No restrictions",
  "Vegetarian",
  "Vegan",
  "Gluten Free",
  "Pescatarian",
  "Food Allergies — I will specify",
  "Drive-Through Only",
];

/** Profile / saved preferences only — includes options removed from per-trip trip_details flow. */
export const DIETARY_PREFERENCE_CHOICES = [
  ...DIETARY_CHOICES,
  "Halal",
  "Kosher",
];

export const ACCESSIBILITY_CHOICES = [
  "No special needs",
  "Wheelchair accessible stops",
  "Wheelchair accessible lodging required",
  "Traveling with elderly passengers",
  "Traveling with young children",
  "Service animal accommodations",
  "Refrigerated medication — pharmacy stops needed",
  "Dialysis centers along route",
  "Sick pet — veterinary care needed",
];

export const TRUCK_STOPS_INTERESTS = [
  "Truck stop restaurants",
  "Weigh station awareness",
  "Scenic pullouts for breaks",
  "Historic roadside stops",
  "No specific interests",
];

export const STOPS_INTERESTS_BASE = [
  "National Parks or Nature",
  "Casinos",
  "Landmarks or Historical Sites",
  "Beaches",
  "Amusement Parks",
  "Shopping Malls or Outlets",
  "Sports Venues",
  "Music Venues",
  "Remote work — WiFi cafés",
  "Comedy clubs or sports bars",
  "Drive-In Movie Theaters",
  "Antique Shops or Flea Markets",
  "Prayer facilities",
  "No specific interests",
];

export const FAMILY_INTERESTS = [
  "Playground or park",
  "Breastfeeding friendly stop",
  "Kid friendly attractions",
];

/** Plane and ferry destination interests — not used on road-trip fun-stops lists. */
export const DESTINATION_INTEREST_LABELS = {
  music_nightlife: "Music and nightlife",
};

export const DESTINATION_INTEREST_CHOICES = [
  "Nature and outdoors",
  "Cities and culture",
  "Food and dining",
  { value: "music_nightlife", label: "Music and nightlife" },
  "Adventure and activities",
  "History and landmarks",
  "Relaxation and beaches",
  "No specific interests",
];

export function formatStopInterestForHints(value) {
  return DESTINATION_INTEREST_LABELS[value] || value;
}

export function getStopsInterestsHintLabel(answers = {}) {
  const effective = getEffectiveVehicle(answers);
  if (effective === "Plane" || effective === "Ferry" || isWaterVehicle(effective)) {
    return "Destination interests";
  }
  return "Fun stops";
}

export function formatStopsInterestsForHints(answers = {}) {
  const interests = asArray(answers.stops_interests).filter(i => i && i !== "No specific interests");
  return interests.map(formatStopInterestForHints).join(", ");
}

export const TRIP_BUDGET_CHOICES = [
  "No budget limit",
  "Under $200",
  "$200 to $500",
  "$500 to $1000",
  "Over $1000",
];

export const LOYALTY_CHOICES = [
  "No preference",
  "Marriott Bonvoy",
  "Hilton Honors",
  "IHG",
  "Hyatt",
  "Wyndham",
];

export const NEARBY_SERVICE_CATEGORIES = [
  { id: "pharmacy", label: "Pharmacy", type: "pharmacy" },
  { id: "hospital", label: "Hospital", type: "hospital" },
  { id: "urgent_care", label: "Urgent care", keyword: "urgent care" },
  { id: "dialysis", label: "Dialysis center", keyword: "dialysis center" },
  { id: "vet", label: "Veterinary care", type: "veterinary_care" },
  { id: "auto_repair", label: "Auto repair", type: "car_repair" },
  { id: "atm", label: "ATM", type: "atm" },
  { id: "car_wash", label: "Car wash", type: "car_wash" },
  { id: "laundry", label: "Laundromat", keyword: "laundromat" },
  { id: "tire", label: "Tire service", keyword: "tire shop" },
  { id: "windshield", label: "Windshield repair", keyword: "auto glass repair" },
  { id: "shipping", label: "Shipping stores", keyword: "FedEx UPS shipping" },
];

const PERSONAL = ["Car", "Motorcycle", "SUV or Van", "Rental Car"];

export function isPersonalVehicle(vehicle) {
  return PERSONAL.includes(vehicle);
}

const MOTORCYCLE_TOWING_MILES = 80;

export function needsTowingQuestion(answers, context = {}) {
  const v = getEffectiveVehicle(answers);
  const miles = context.routeDistanceMiles ?? parseMilesFromDistance(context?.routeDistance);
  const dayTrip = miles != null && miles < 150;
  if (v === "Rental Car") return !dayTrip;
  if (v === "Car" || v === "SUV or Van") return !dayTrip;
  if (v === "Motorcycle") {
    return miles == null || miles >= MOTORCYCLE_TOWING_MILES;
  }
  return false;
}

export const MOTORCYCLE_TOWING_CHOICES = [
  "No, just the bike",
  "Yes — sidecar or trailer",
];

export function needsKidsAgesDetail(answers) {
  const childCount = Number(answers?.child_count);
  if (childCount > 0) return true;
  return hasAccessibility(answers, "Traveling with young children");
}

export function needsTruckExternalLodging(answers) {
  const v = getEffectiveVehicle(answers);
  const sleeper = String(answers.sleeper_cab || "");
  return isTruckVehicle(v) && (sleeper.startsWith("No") || sleeper.includes("No —"));
}

export function isTowingSelected(answers) {
  const t = answers?.towing;
  if (!t) return false;
  if (t === "No" || t === "No, just the bike") return false;
  return true;
}

export function isLargeParty(answers) {
  const n = parseTravelerCount(answers?.travelers);
  return n != null && n >= 3;
}

export function getStopsInterestsChoices(answers) {
  const vehicle = getEffectiveVehicle(answers);
  if (isTruckVehicle(vehicle)) return [...TRUCK_STOPS_INTERESTS];
  const base = [...STOPS_INTERESTS_BASE];
  if (isLargeParty(answers)) return [...base, ...FAMILY_INTERESTS];
  return base;
}

export function asArray(val) {
  if (Array.isArray(val)) return val.filter(Boolean);
  if (val == null || val === "") return [];
  return [val];
}

export function hasAccessibility(answers, option) {
  return asArray(answers?.accessibility).includes(option);
}

export function needsWheelchairFilter(answers) {
  return hasAccessibility(answers, "Wheelchair accessible stops");
}

export function needsWheelchairLodgingFilter(answers) {
  return hasAccessibility(answers, "Wheelchair accessible lodging required");
}

export function needsRefrigeratedMedStops(answers) {
  return hasAccessibility(answers, "Refrigerated medication — pharmacy stops needed");
}

export function needsDialysisServices(answers) {
  return hasAccessibility(answers, "Dialysis centers along route");
}

export function needsVetServices(answers) {
  return hasAccessibility(answers, "Sick pet — veterinary care needed");
}

/** Nearby service category ids to fetch based on accessibility selections. */
export function getActiveServiceCategoryIds(answers) {
  const ids = ["pharmacy", "hospital", "urgent_care", "auto_repair", "atm", "car_wash", "laundry", "tire", "windshield", "shipping"];
  if (needsDialysisServices(answers)) ids.push("dialysis");
  if (needsVetServices(answers)) ids.push("vet");
  if (needsRefrigeratedMedStops(answers) && !ids.includes("pharmacy")) ids.push("pharmacy");
  return ids;
}

export function needsElderlyRest(answers) {
  return hasAccessibility(answers, "Traveling with elderly passengers");
}

export function needsYoungChildrenRest(answers) {
  return hasAccessibility(answers, "Traveling with young children");
}

export function needsSafeStopsOnly(answers) {
  const prefs = asArray(answers?.preferences);
  if (prefs.includes("Safe, well-lit stops only")) return true;
  const acc = asArray(answers?.accessibility);
  return acc.includes("Traveling with elderly passengers")
    || acc.includes("Traveling with young children");
}

export function prefIncludes(answers, value) {
  return asArray(answers?.preferences).includes(value);
}

export function needsFoodAllergyDetail(answers) {
  return asArray(answers?.dietary).includes("Food Allergies — I will specify");
}

export function isTeslaSuperchargerOnly(answers) {
  const ft = answers?.fuel_type || "";
  return ft === "Electric — Tesla Superchargers" || ft === "Electric — Tesla Superchargers only";
}

export function getTripBudgetCap(answers) {
  const b = answers?.trip_budget;
  if (!b || b === "No budget limit") return null;
  if (b === "Under $200") return 200;
  if (b === "$200 to $500") return 500;
  if (b === "$500 to $1000") return 1000;
  if (b === "Over $1000") return 1500;
  return null;
}

export function getDietarySearchKeywords(answers) {
  const dietary = asArray(answers?.dietary);
  if (!dietary.length || dietary.includes("No restrictions")) return [];
  const map = {
    Vegetarian: "vegetarian restaurant",
    Vegan: "vegan restaurant",
    "Gluten Free": "gluten free restaurant",
    Halal: "halal restaurant",
    Kosher: "kosher restaurant",
    Pescatarian: "seafood restaurant",
    "Drive-Through Only": "drive through restaurant",
  };
  const keys = dietary.filter(d => map[d]).map(d => map[d]);
  if (dietary.includes("Food Allergies — I will specify") && answers?.food_allergies?.trim()) {
    keys.push(`${answers.food_allergies.trim()} allergy friendly restaurant`);
  }
  return keys;
}

export function getFuelRangeMiles(answers) {
  const v = getEffectiveVehicle(answers);
  const ft = answers?.fuel_type || answers?.fuel;
  if (ft === "Electric" || ft === "Electric (EV)" || ft?.includes("Tesla")) return 200;
  if (isRvVehicle(v)) return 200;
  if (isTruckVehicle(v)) return 250;
  return 300;
}

export function getLoyaltyKeyword(answers) {
  const l = answers?.loyalty_program;
  if (!l || l === "No preference") return null;
  const map = {
    "Marriott Bonvoy": "Marriott",
    "Hilton Honors": "Hilton",
    IHG: "Holiday Inn",
    Hyatt: "Hyatt",
    Wyndham: "Wyndham",
  };
  return map[l] || l.split(" ")[0];
}
