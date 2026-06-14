/** Dietary search keywords — kept in sync with src/lib/tripAccommodations.js */

function asArray(val) {
  if (Array.isArray(val)) return val.filter(Boolean);
  if (val == null || val === "") return [];
  return [val];
}

export function getDietarySearchKeywords(answers = {}) {
  const dietary = asArray(answers.dietary);
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
  if (dietary.includes("Food Allergies — I will specify") && answers.food_allergies?.trim()) {
    keys.push(`${answers.food_allergies.trim()} allergy friendly restaurant`);
  }
  return keys;
}

export function dietaryMatchesRestaurant(restaurant, answers = {}) {
  const dietary = asArray(answers.dietary);
  if (!dietary.length || dietary.includes("No restrictions")) return true;

  const name = (restaurant.name || "").toLowerCase();
  const types = (restaurant.types || []).join(" ").toLowerCase();
  const blob = `${name} ${types} ${restaurant.description || ""}`.toLowerCase();

  const checks = [];
  if (dietary.includes("Vegetarian")) checks.push(/vegetarian|veggie|plant/i);
  if (dietary.includes("Vegan")) checks.push(/vegan|plant.based|100% plant/i);
  if (dietary.includes("Gluten Free")) checks.push(/gluten.free|celiac|gf\b/i);
  if (dietary.includes("Halal")) checks.push(/halal/i);
  if (dietary.includes("Kosher")) checks.push(/kosher/i);
  if (dietary.includes("Pescatarian")) checks.push(/seafood|fish|sushi/i);

  if (!checks.length) return true;
  return checks.some(re => re.test(blob));
}
