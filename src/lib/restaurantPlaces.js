import { filterDinnerRestaurants, sortRestaurantsForDinner } from "./restaurantHours.js";
import { parseTravelerCount } from "./vehicles.js";

/** Pick 3 display restaurants: sit-down, mid-range, quick/fast food. */
const FAST_FOOD_RE = /\b(mcdonald|burger king|wendy|taco bell|kfc|subway|chipotle|panda express|arby|sonic|jack in the box|dairy queen|popeyes|chick-fil-a|five guys|in-n-out|whataburger|starbucks|dunkin|fast food|quick service)\b/i;

export const MEAL_COST_BY_PRICE_LEVEL = {
  1: 10,
  2: 20,
  3: 35,
  4: 60,
};

export function mealCostForPriceLevel(level) {
  return MEAL_COST_BY_PRICE_LEVEL[level] ?? MEAL_COST_BY_PRICE_LEVEL[2];
}

function isQuick(r) {
  if (r.types?.includes("fast_food_restaurant") || r.types?.includes("meal_takeaway")) return true;
  return FAST_FOOD_RE.test(r.name || "") || (r.priceLevel ?? 2) <= 1;
}

function isSitDown(r) {
  return !isQuick(r) && (r.priceLevel == null || r.priceLevel >= 2);
}

function isMidRange(r) {
  const pl = r.priceLevel ?? 2;
  return pl === 2 || (!isQuick(r) && pl <= 3);
}

export function selectDisplayRestaurants(restaurants = [], { arrivalTime = null } = {}) {
  const pool = arrivalTime
    ? filterDinnerRestaurants(sortRestaurantsForDinner(restaurants, arrivalTime), arrivalTime)
    : restaurants;
  if (!pool.length) return [];

  const used = new Set();
  const pick = (predicate, slot) => {
    const found = pool.find(r => !used.has(r.placeId) && predicate(r));
    if (found) {
      used.add(found.placeId);
      return { ...found, slot };
    }
    return null;
  };

  const sitDown = pick(isSitDown, "sit_down");
  const midRange = pick(isMidRange, "mid_range");
  const quick = pick(isQuick, "quick");

  const ordered = [sitDown, midRange, quick].filter(Boolean);

  if (ordered.length < 3) {
    pool.forEach(r => {
      if (ordered.length >= 3 || used.has(r.placeId)) return;
      used.add(r.placeId);
      ordered.push({ ...r, slot: "extra" });
    });
  }

  return ordered.slice(0, 3);
}

export function estimateFoodCostFromRestaurants(restaurantsByCity, answers, nights) {
  const partySize = parsePartySize(answers?.travelers);
  const stopCount = Math.max(1, nights || Object.keys(restaurantsByCity || {}).length);
  let totalPerMeal = 0;
  let stopMeals = 0;

  Object.values(restaurantsByCity || {}).forEach(list => {
    const display = selectDisplayRestaurants(list);
    if (!display.length) return;
    const avgLevel = display.reduce((s, r) => s + (r.priceLevel ?? 2), 0) / display.length;
    const rounded = Math.min(4, Math.max(1, Math.round(avgLevel)));
    totalPerMeal += mealCostForPriceLevel(rounded);
    stopMeals += 1;
  });

  if (stopMeals === 0) return null;
  const avgMeal = totalPerMeal / stopMeals;
  return Math.round(avgMeal * partySize * stopCount);
}

function parsePartySize(travelers) {
  return parseTravelerCount(travelers) ?? 2;
}
