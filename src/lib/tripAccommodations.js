/** Shared constants and helpers for human-possibility accommodations. */
import { getEffectiveVehicle, isTruckVehicle, isRvVehicle, parseTravelerCount } from "./vehicles.js";

export const FUEL_TYPE_CHOICES = [
  "Gasoline",
  "Diesel",
  "Electric",
  "Electric — Tesla Superchargers only",
  "Hybrid",
  "Propane",
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
  "Halal",
  "Kosher",
  "Gluten Free",
  "Food Allergies — I will specify",
  "Drive-Through Only",
];

export const ACCESSIBILITY_CHOICES = [
  "No special needs",
  "Wheelchair accessible stops required",
  "Wheelchair accessible lodging required",
  "Traveling with elderly passengers",
  "Traveling while pregnant",
  "Service animal accommodations needed",
  "Prefer highly rated safe stops only",
  "Traveling with refrigerated medication — need stops with refrigeration available",
  "Need dialysis centers along route",
  "Traveling with a sick pet — need veterinary clinics along route",
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
  "Prayer facilities",
  "Remote work — WiFi cafés",
  "Live Music Venues",
  "Comedy Clubs or Sports Bars",
  "Drive-In Movie Theaters",
  "Antique Shops or Flea Markets",
  "No specific interests",
];

export const FAMILY_INTERESTS = [
  "Playground or park",
  "Breastfeeding friendly stop",
  "Kid friendly attractions",
];

export const TRIP_BUDGET_CHOICES = [
  "No budget limit",
  "Under $200",
  "$200 to $500",
  "$500 to $1000",
  "Over $1000",
];

export const SCHEDULE_CHOICES = [
  "No restrictions",
  "Cannot travel on Saturdays — Sabbath observant",
  "Cannot travel on Sundays",
  "Prefer to drive during specific hours only — I will specify",
  "Night driving only",
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
  { id: "auto_repair", label: "Auto repair", type: "car_repair" },
  { id: "atm", label: "ATM", type: "atm" },
  { id: "car_wash", label: "Car wash", type: "car_wash" },
  { id: "laundry", label: "Laundromat", keyword: "laundromat" },
  { id: "tire", label: "Tire service", keyword: "tire shop" },
  { id: "windshield", label: "Windshield repair", keyword: "auto glass repair" },
  { id: "dialysis", label: "Dialysis center", keyword: "dialysis center" },
  { id: "vet", label: "Veterinary care", type: "veterinary_care" },
  { id: "shipping", label: "Shipping stores", keyword: "FedEx UPS shipping" },
  { id: "religious", label: "Prayer facilities", keyword: "mosque church temple" },
];

const PERSONAL = ["Car", "Motorcycle", "SUV or Van", "Rental Car"];

export function isPersonalVehicle(vehicle) {
  return PERSONAL.includes(vehicle);
}

export function isNonCommercial(answers) {
  const v = getEffectiveVehicle(answers);
  return isPersonalVehicle(v) || isRvVehicle(v);
}

export function needsTowingQuestion(answers) {
  const v = getEffectiveVehicle(answers);
  return v === "Car" || v === "SUV or Van";
}

export function isTowingSelected(answers) {
  const t = answers?.towing;
  return t && t !== "No";
}

export function isLargeParty(answers) {
  const n = parseTravelerCount(answers?.travelers);
  return n != null && n >= 3;
}

export function getStopsInterestsChoices(answers) {
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
  return hasAccessibility(answers, "Wheelchair accessible stops required")
    || hasAccessibility(answers, "Wheelchair accessible lodging required");
}

export function needsElderlyOrPregnantRest(answers) {
  return hasAccessibility(answers, "Traveling with elderly passengers")
    || hasAccessibility(answers, "Traveling while pregnant");
}

export function needsSafeStopsOnly(answers) {
  return hasAccessibility(answers, "Prefer highly rated safe stops only");
}

export function needsRefrigeratedMeds(answers) {
  return hasAccessibility(answers, "Traveling with refrigerated medication — need stops with refrigeration available");
}

export function needsDialysis(answers) {
  return hasAccessibility(answers, "Need dialysis centers along route");
}

export function needsVetCare(answers) {
  return hasAccessibility(answers, "Traveling with a sick pet — need veterinary clinics along route");
}

export function needsFoodAllergyDetail(answers) {
  return asArray(answers?.dietary).includes("Food Allergies — I will specify");
}

export function needsScheduleHours(answers) {
  return answers?.schedule_restrictions === "Prefer to drive during specific hours only — I will specify";
}

export function isTeslaSuperchargerOnly(answers) {
  return answers?.fuel_type === "Electric — Tesla Superchargers only";
}

export function isNightDrivingOnly(answers) {
  return answers?.schedule_restrictions === "Night driving only";
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
    Halal: "halal restaurant",
    Kosher: "kosher restaurant",
    "Gluten Free": "gluten free restaurant",
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
