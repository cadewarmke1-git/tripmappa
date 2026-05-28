import { parseMilesFromDistance, parseHoursFromDuration } from "./parsing.js";
import { hasPref, parseTravelerCount } from "./vehicles.js";
import { countFlowQuestionsAnswered } from "./tripFlow.js";
import { estimateFoodCostFromRestaurants } from "./restaurantPlaces.js";
import { estimateTripFuelCost } from "./fuel.js";

export const LODGING_NIGHTLY_RATES = {
  Budget: 65,
  "Mid-Range": 115,
  Luxury: 220,
  "Airbnb or Vacation Rental": 125,
  "Camping or Outdoors": 35,
  "Doesn't Matter": 100,
  Hotel: 130,
  Motel: 75,
  Airbnb: 110,
  Camping: 35,
  "Doesn't matter": 100,
  "Budget hotel": 75,
  "Mid-range hotel": 130,
  "Upscale hotel": 220,
  "Luxury hotel": 400,
  Campground: 35,
  "No overnight stay": 0,
  "Truck stop (Pilot/Flying J/Love's)": 0,
  "Motel near truck stop": 65,
  "Sleeper cab — no hotel needed": 0,
  "Rest area": 0,
  "Weigh station area": 0,
  "Mid-range": 130,
  Upscale: 220,
  "RV Park": 55,
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

function lodgingNightlyRate(answers, selectedLodging) {
  if (selectedLodging?.length) {
    const avg = selectedLodging.reduce((sum, l) => sum + (l.pricePerNight || 0), 0) / selectedLodging.length;
    if (avg > 0) return Math.round(avg);
  }
  return LODGING_NIGHTLY_RATES[answers.lodging] ?? null;
}

function buildAddedStopItems(roadStops) {
  return (roadStops || [])
    .filter(s => s.userAdded && s.estimatedCost != null)
    .map(s => ({
      id: s.id || `${s.category}-${s.name}`,
      label: s.name || s.location,
      category: s.category,
      cost: s.estimatedCost,
    }));
}

export function computeBudgetEstimate(answers, routeInfo, tripLegs, options = {}) {
  const { roadStops = [], selectedLodging = [], restaurantsByCity = {} } = options;

  let miles = parseMilesFromDistance(routeInfo?.distance);
  if (!miles && tripLegs.length > 0) {
    miles = tripLegs.reduce((sum, leg) => sum + (parseMilesFromDistance(leg.distance) || 0), 0);
  }
  const hours = parseHoursFromDuration(routeInfo?.duration)
    || (tripLegs.length ? tripLegs.reduce((s, l) => s + (parseHoursFromDuration(l.duration) || 0), 0) : null);

  const baseFuel = miles != null && answers.vehicle
    ? estimateFuelCost(miles, answers.vehicle, answers.preferences, answers)
    : null;

  const addedStops = buildAddedStopItems(roadStops);
  const addedFuelCost = addedStops
    .filter(s => s.category === "fuel" || s.category === "charging")
    .reduce((sum, s) => sum + s.cost, 0);
  const addedFoodCost = addedStops
    .filter(s => s.category === "food")
    .reduce((sum, s) => sum + s.cost, 0);

  const fuel = baseFuel != null ? baseFuel + addedFuelCost : null;

  const nights = estimateOvernightStops(hours, answers.trip_type, answers.lodging);
  const lodgingRate = lodgingNightlyRate(answers, selectedLodging);
  let lodging = null;
  if (selectedLodging.length && nights > 0) {
    lodging = selectedLodging.reduce((sum, l) => sum + (l.pricePerNight || 0), 0) * nights;
  } else if (nights === 0 && (hours != null || answers.lodging)) {
    lodging = 0;
  } else if (lodgingRate != null && nights > 0) {
    lodging = lodgingRate * nights;
  } else if (answers.lodging && nights === 0) {
    lodging = 0;
  }

  const tripDays = hours ? Math.max(1, Math.ceil(hours / 8)) : null;
  const partySize = parseTravelerCount(answers.travelers) ?? 2;
  let food = null;

  const placesFood = estimateFoodCostFromRestaurants(restaurantsByCity, answers, nights);
  if (placesFood != null) {
    food = placesFood + addedFoodCost;
  } else if (tripDays) {
    const wantsRestaurants = hasPref(answers, "Sit down restaurants only")
      || hasPref(answers, "Fast food only");
    const perPersonPerDay = wantsRestaurants ? 32 : 12;
    food = tripDays * partySize * perPersonPerDay + addedFoodCost;
  } else if (addedFoodCost) {
    food = addedFoodCost;
  }

  const total = fuel != null && lodging != null && food != null ? fuel + lodging + food : null;

  return {
    fuel,
    lodging,
    food,
    total,
    miles,
    nights,
    tripDays,
    baseFuel,
    addedStops,
    addedFuelCost,
    addedFoodCost,
  };
}

export function estimateRoadStopCost(stop) {
  return estimateStopCost(stop, stop.category === "charging" ? "ev" : stop.category);
}
