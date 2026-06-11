/** Compact constraint list for results UI and Sonnet generation hints. */
import { sanitizeHintText } from "./hintSanitization.js";
import { getEffectiveVehicle } from "./vehicles.js";
import { isContinuousDrive } from "./driveMode.js";
import {
  formatFamilyContextHints,
  formatMultiVehicleCoordinationBlock,
  formatTripDetailsDefaultSignals,
  formatTruckContextBlock,
  formatTravelersContextLines,
  formatTripNightsLine,
  formatPetConstraintLine,
  formatScheduleConstraintForHints,
} from "./generationContext.js";
import {
  asArray,
  getTripBudgetCap,
  getStopsInterestsHintLabel,
  formatStopsInterestsForHints,
  needsDialysisServices,
  needsRefrigeratedMedStops,
  needsVetServices,
  needsWheelchairLodgingFilter,
  isTowingSelected,
} from "./tripAccommodations.js";

export function buildTripConstraints(answers = {}, routeInfo = null) {
  const items = [];
  const vehicle = getEffectiveVehicle(answers);

  if (vehicle) items.push({ id: "vehicle", label: "Vehicle", value: vehicle });

  const dietary = asArray(answers.dietary).filter(d => d && d !== "No restrictions");
  if (dietary.length) items.push({ id: "dietary", label: "Diet", value: dietary.join(", ") });

  if (answers.food_allergies?.trim() && answers.food_allergies !== "None specified") {
    items.push({ id: "allergies", label: "Allergies", value: answers.food_allergies.trim() });
  }

  const accessibility = asArray(answers.accessibility).filter(a => a && a !== "No special needs");
  if (accessibility.length) items.push({ id: "accessibility", label: "Access & medical", value: accessibility.join(", ") });

  const scheduleVal = formatScheduleConstraintForHints(answers);
  if (scheduleVal) items.push({ id: "schedule", label: "Schedule", value: scheduleVal });

  const prefs = asArray(answers.preferences);
  if (prefs.length) items.push({ id: "preferences", label: "Route prefs", value: prefs.join(", ") });

  const interestsVal = formatStopsInterestsForHints(answers);
  if (interestsVal) {
    items.push({ id: "interests", label: getStopsInterestsHintLabel(answers), value: interestsVal });
  }

  const cap = getTripBudgetCap(answers);
  if (cap != null) items.push({ id: "budget", label: "Budget cap", value: `$${cap} total` });

  if (answers.lodging && !isContinuousDrive(answers)) {
    items.push({ id: "lodging", label: "Lodging", value: answers.lodging });
  }

  if (isTowingSelected(answers)) {
    items.push({ id: "towing", label: "Towing", value: answers.towing });
  }

  if (answers.fuel_type) items.push({ id: "fuel", label: "Fuel", value: answers.fuel_type });

  const fuelBrand = answers.truck_stop_brand || answers.fuel_brand_preference;
  if (fuelBrand && fuelBrand !== "No preference") {
    items.push({ id: "fuel_brand", label: "Preferred fuel brand", value: fuelBrand });
  }

  if (answers.restaurant_preference && !dietary.length) {
    items.push({ id: "restaurant_pref", label: "Learned restaurant style", value: answers.restaurant_preference });
  }

  if (routeInfo?.distance) {
    items.push({ id: "route", label: "Route", value: `${routeInfo.distance} · ${routeInfo.duration || ""}`.trim() });
  }

  return items;
}

/** Plain-text block appended to Sonnet user prompt via generationHints. */
export function formatGenerationHints(answers = {}, routeInfo = null, options = {}) {
  const lines = [];
  const { regenerateDiffBlock = "", collaborationHintsBlock = "", actionTipHintsBlock = "" } = options;

  const actionTips = sanitizeHintText(actionTipHintsBlock);
  if (actionTips) {
    lines.push(actionTips, "");
  }

  const regen = sanitizeHintText(regenerateDiffBlock);
  if (regen) {
    lines.push(regen, "");
  }

  const collab = sanitizeHintText(collaborationHintsBlock);
  if (collab) {
    lines.push(collab, "");
  }

  const coordinationBlock = formatMultiVehicleCoordinationBlock(answers);
  if (coordinationBlock) {
    lines.push(coordinationBlock, "");
  }

  lines.push("=== USER CONSTRAINTS (MUST shape every stop recommendation) ===");
  buildTripConstraints(answers, routeInfo).forEach(({ label, value }) => {
    lines.push(`${label}: ${value}`);
  });

  const truckBlock = formatTruckContextBlock(answers);
  if (truckBlock) {
    lines.push("");
    lines.push(truckBlock);
  }

  for (const travelerLine of formatTravelersContextLines(answers)) {
    lines.push(travelerLine);
  }

  const nightsLine = formatTripNightsLine(answers);
  if (nightsLine) lines.push(nightsLine);

  const petLine = formatPetConstraintLine(answers);
  if (petLine) lines.push(petLine);

  for (const signal of formatTripDetailsDefaultSignals(answers)) {
    lines.push(signal);
  }

  for (const hint of formatFamilyContextHints(answers)) {
    lines.push(hint);
  }

  if (answers.inferredRestaurantHint) {
    lines.push(answers.inferredRestaurantHint);
  }

  if (needsWheelchairLodgingFilter(answers)) {
    lines.push("MUST: Only suggest wheelchair-accessible lodging with roll-in access where possible.");
  }
  if (needsRefrigeratedMedStops(answers)) {
    lines.push("MUST: Every overnight stop needs pharmacy or medical facility access nearby for refrigerated medication.");
  }
  if (needsDialysisServices(answers)) {
    lines.push("MUST: Flag dialysis center access within 10 miles of each overnight stop.");
  }
  if (needsVetServices(answers)) {
    lines.push("MUST: Flag veterinary or emergency animal hospital access near overnight stops.");
  }
  if (isTowingSelected(answers)) {
    lines.push("MUST: Recommend stops with trailer/truck parking; avoid tight downtown areas; note pull-through fuel lanes.");
  }
  if (isContinuousDrive(answers)) {
    lines.push("MUST: No overnight lodging — fuel and rest stops only, spaced for the full continuous drive.");
  }

  const schedule = asArray(answers.schedule_restrictions).filter(s => s && s !== "No restrictions");
  if (schedule.some(s => /Saturday|Sabbath/i.test(s))) {
    lines.push("MUST: Do not schedule driving segments on Saturday — place overnight stop before Sabbath begins.");
  }
  if (schedule.some(s => /Sunday/i.test(s))) {
    lines.push("MUST: Do not schedule driving segments on Sunday.");
  }

  lines.push("If placesContext lists verified business names, use those exact names — never invent alternatives.");
  return lines.join("\n");
}
