/** Map stop/marker categories to vintage neon sign shape families. */

export const SIGN_LABELS = {
  food: "Food",
  fuel: "Fuel",
  lodging: "Lodging",
  general: "Stop",
};

export function roadStopToSignCategory(category) {
  const c = String(category || "").toLowerCase();
  if (/food|rest|dining/.test(c)) return "food";
  if (/fuel|gas|charg|diesel|ev|truck/.test(c)) return "fuel";
  if (/lodg|hotel|overnight|camp/.test(c)) return "lodging";
  return "general";
}

export function markerToSignCategory(markerCategory) {
  const c = String(markerCategory || "").toLowerCase();
  if (c === "restaurant" || c === "food") return "food";
  if (c === "fuel" || c === "ev" || c === "truck") return "fuel";
  if (c === "hotel" || c === "rv") return "lodging";
  if (c === "rest") return "general";
  return "general";
}

export function signCategoryLabel(signCategory, fallback = "Stop") {
  return SIGN_LABELS[signCategory] || fallback;
}
