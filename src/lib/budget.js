import { parseMilesFromDistance, parseHoursFromDuration } from "./parsing.js";
import { hasFamilyKids, hasPref } from "./vehicles.js";
import { countFlowQuestionsAnswered } from "./tripFlow.js";
import { estimateTripFuelCost } from "./fuel.js";

export const LODGING_NIGHTLY_RATES = {
  "Budget hotel": 75, "Mid-range hotel": 130, "Upscale hotel": 220, "Luxury hotel": 400,
  Campground: 35, Airbnb: 110, "No overnight stay": 0,
  "Truck stop (Pilot/Flying J/Love's)": 0, "Motel near truck stop": 65,
  "Sleeper cab — no hotel needed": 0, "Rest area": 0, "Weigh station area": 0,
  Budget: 75, "Mid-range": 130, Upscale: 220, Luxury: 400, "RV Park": 55,
};

export function estimateOvernightStops(hours, tripType, lodging) {
  if (tripType === "Day trip" || tripType === "Driving home" || lodging === "No overnight stay") return 0;
  if (lodging === "Sleeper cab — no hotel needed" || lodging === "Rest area" || lodging === "Weigh station area") return 0;
  if (!hours) return 0;
  if (hours <= 11) return 0;
  return Math.max(1, Math.ceil(hours / 11) - 1);
}

export function estimateFuelCost(miles, vehicle, preferences, answers) {
  if (answers) return estimateTripFuelCost(miles, answers);
  if (!miles || miles <= 0) return null;
  return Math.round((miles / 28) * 3.45);
}

export function countAnsweredQuestions(answers) {
  return countFlowQuestionsAnswered(answers);
}

export function computeBudgetEstimate(answers, routeInfo, tripLegs) {
  let miles = parseMilesFromDistance(routeInfo?.distance);
  if (!miles && tripLegs.length > 0) {
    miles = tripLegs.reduce((sum, leg) => sum + (parseMilesFromDistance(leg.distance) || 0), 0);
  }
  const hours = parseHoursFromDuration(routeInfo?.duration)
    || (tripLegs.length ? tripLegs.reduce((s, l) => s + (parseHoursFromDuration(l.duration) || 0), 0) : null);

  const prefs = answers.preferences || [];
  const fuel = miles != null && answers.vehicle
    ? estimateFuelCost(miles, answers.vehicle, prefs, answers)
    : null;
  const nights = estimateOvernightStops(hours, answers.trip_type, answers.lodging);
  const lodgingRate = LODGING_NIGHTLY_RATES[answers.lodging] ?? null;
  let lodging = null;
  if (nights === 0 && (hours != null || answers.lodging)) lodging = 0;
  else if (lodgingRate != null && nights > 0) lodging = lodgingRate * nights;
  else if (answers.lodging && nights === 0) lodging = 0;

  const tripDays = hours ? Math.max(1, Math.ceil(hours / 8)) : null;
  const hasKids = hasFamilyKids(answers.travelers);
  let food = null;
  if (tripDays) {
    const wantsRestaurants = hasPref(answers, "Restaurant recommendations");
    const adultPerDay = wantsRestaurants ? 65 : 25;
    const childPerDay = hasKids ? 15 : 0;
    food = tripDays * (adultPerDay + childPerDay);
  }

  const total = fuel != null && lodging != null && food != null ? fuel + lodging + food : null;

  return { fuel, lodging, food, total, miles, nights, tripDays };
}
