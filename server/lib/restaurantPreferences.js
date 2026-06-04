/** Shared restaurant preference filtering for Google Places. */
import { dietaryMatchesRestaurant } from "./dietaryKeywords.js";

const FAST_FOOD_RE = /\b(mcdonald|burger king|wendy|taco bell|kfc|subway|chipotle|panda express|arby|sonic|jack in the box|dairy queen|popeyes|chick-fil-a|five guys|in-n-out|whataburger|culver|zaxby|raising cane|del taco|white castle|hardee|carl's jr|pizza hut|domino|little caesar|papa john|panera|starbucks|dunkin|jamba|smoothie king|bojangles|checkers|rally|steak 'n shake|culver's|qdoba|moe's|jersey mike|firehouse subs|jimmy john|potbelly|noodles|fast food|quick service)\b/i;

const CUISINE_TYPES = {
  american_restaurant: "American",
  barbecue_restaurant: "BBQ",
  chinese_restaurant: "Chinese",
  fast_food_restaurant: "Fast Food",
  french_restaurant: "French",
  greek_restaurant: "Greek",
  hamburger_restaurant: "Burgers",
  indian_restaurant: "Indian",
  italian_restaurant: "Italian",
  japanese_restaurant: "Japanese",
  korean_restaurant: "Korean",
  mexican_restaurant: "Mexican",
  pizza_restaurant: "Pizza",
  seafood_restaurant: "Seafood",
  steak_house: "Steakhouse",
  sushi_restaurant: "Sushi",
  thai_restaurant: "Thai",
  vegan_restaurant: "Vegan",
  vegetarian_restaurant: "Vegetarian",
  meal_takeaway: "Takeout",
  cafe: "Café",
  bakery: "Bakery",
  bar: "Bar & Grill",
  restaurant: "Restaurant",
};

export function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function priceSigns(level) {
  if (level == null || level < 1) return "$";
  return "$".repeat(Math.min(4, Math.max(1, level)));
}

export function cuisineFromTypes(types = []) {
  for (const t of types) {
    if (CUISINE_TYPES[t]) return CUISINE_TYPES[t];
  }
  const food = types.find(t => t.includes("restaurant") || t === "cafe" || t === "bakery");
  if (food) return food.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return "Restaurant";
}

export function cuisineFromFoursquareCategories(categories = []) {
  const names = categories.map(c => (c.name || "").toLowerCase());
  if (names.some(n => /fast food|quick service/i.test(n))) return "Fast Food";
  if (names.some(n => /pizza/i.test(n))) return "Pizza";
  if (names.some(n => /mexican/i.test(n))) return "Mexican";
  if (names.some(n => /italian/i.test(n))) return "Italian";
  if (names.some(n => /sushi|japanese/i.test(n))) return "Japanese";
  if (names.some(n => /steak/i.test(n))) return "Steakhouse";
  if (names.some(n => /seafood/i.test(n))) return "Seafood";
  if (names.some(n => /cafe|coffee/i.test(n))) return "Café";
  const primary = categories[0]?.name;
  return primary || "Restaurant";
}

export function descriptionFromTypes(types = [], name = "") {
  const cuisine = cuisineFromTypes(types);
  if (/play/i.test(name)) return `${cuisine} with a play area — great for families.`;
  if (types.includes("fast_food_restaurant") || types.includes("meal_takeaway")) {
    return `Quick ${cuisine.toLowerCase()} stop near your route.`;
  }
  if (types.includes("bar")) return `${cuisine} with full menu and drinks.`;
  return `Popular ${cuisine.toLowerCase()} spot with solid reviews nearby.`;
}

function isFastFood(place, name) {
  const types = place.types || [];
  if (types.includes("fast_food_restaurant") || types.includes("meal_takeaway")) return true;
  return FAST_FOOD_RE.test(name);
}

function isSitDown(place, name) {
  const price = place.price_level ?? place.priceLevel;
  if (isFastFood(place, name)) return false;
  return price == null || price >= 2;
}

function hasOutdoorSeating(types = [], name = "") {
  return types.includes("bar") || /patio|outdoor|terrace|garden/i.test(name);
}

function hasPlayArea(name = "") {
  return /play\s*area|playground|play place|playland|mcdonald/i.test(name);
}

function prefIncludes(prefs, value) {
  return Array.isArray(prefs) && prefs.includes(value);
}

export function filterByPreferences(candidates, answers = {}, { roadStop = false } = {}) {
  const prefs = answers.preferences || [];
  const lodging = answers.lodging || "";
  const accessibility = answers.accessibility || [];
  const youngKids = accessibility.includes("Traveling with young children")
    || (answers.stops_interests || []).some(i => /kid|child|family|playground/i.test(i));

  let list = [...candidates];

  list = list.filter(p => dietaryMatchesRestaurant(p, answers));

  if (roadStop) {
    list = list.filter(p => isFastFood(p, p.name) || (p.price_level ?? p.priceLevel ?? 2) <= 2);
  } else if (prefIncludes(prefs, "Fast food only")) {
    list = list.filter(p => isFastFood(p, p.name));
  } else if (prefIncludes(prefs, "Sit down restaurants only")) {
    list = list.filter(p => isSitDown(p, p.name));
  }

  if (lodging === "Luxury" || lodging === "Upscale hotel" || lodging === "Luxury hotel") {
    list.sort((a, b) => (b.price_level ?? b.priceLevel ?? 0) - (a.price_level ?? a.priceLevel ?? 0));
  } else if (lodging === "Budget" || lodging === "Budget hotel") {
    list.sort((a, b) => (a.price_level ?? a.priceLevel ?? 2) - (b.price_level ?? b.priceLevel ?? 2));
  }

  return list.map(p => {
    const badges = [];
    if (youngKids && (hasPlayArea(p.name) || /family|kid/i.test(p.name))) {
      badges.push("playArea");
    }
    if (youngKids) badges.push("familyFriendly");
    if (prefIncludes(prefs, "Pet friendly") && hasOutdoorSeating(p.types, p.name)) {
      badges.push("outdoorSeating");
    }
    return { ...p, badges: [...new Set(badges)] };
  });
}
