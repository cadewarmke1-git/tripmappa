/** Compact constraint list for results UI and Sonnet generation hints. */
import { getEffectiveVehicle } from "./vehicles.js";
import { isContinuousDrive } from "./driveMode.js";
import {
  asArray,
  getTripBudgetCap,
  needsDialysisServices,
  needsRefrigeratedMedStops,
  needsVetServices,
  needsWheelchairLodgingFilter,
  isTowingSelected,
} from "./tripAccommodations.js";
import { getScheduleRestrictionLabels } from "./scheduleRestrictions.js";

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

  const schedule = getScheduleRestrictionLabels(answers);
  if (schedule.length) {
    let val = schedule.join(", ");
    if (answers.schedule_drive_hours?.trim()) val += ` (${answers.schedule_drive_hours.trim()})`;
    items.push({ id: "schedule", label: "Schedule", value: val });
  }

  const prefs = asArray(answers.preferences);
  if (prefs.length) items.push({ id: "preferences", label: "Route prefs", value: prefs.join(", ") });

  const interests = asArray(answers.stops_interests).filter(i => i !== "No specific interests");
  if (interests.length) items.push({ id: "interests", label: "Fun stops", value: interests.join(", ") });

  const cap = getTripBudgetCap(answers);
  if (cap != null) items.push({ id: "budget", label: "Budget cap", value: `$${cap} total` });

  if (answers.lodging && !isContinuousDrive(answers)) {
    items.push({ id: "lodging", label: "Lodging", value: answers.lodging });
  }

  if (isTowingSelected(answers)) {
    items.push({ id: "towing", label: "Towing", value: answers.towing });
  }

  if (answers.fuel_type) items.push({ id: "fuel", label: "Fuel", value: answers.fuel_type });

  if (routeInfo?.distance) {
    items.push({ id: "route", label: "Route", value: `${routeInfo.distance} · ${routeInfo.duration || ""}`.trim() });
  }

  return items;
}

/** Plain-text block appended to Sonnet user prompt via generationHints. */
export function formatGenerationHints(answers = {}, routeInfo = null) {
  const lines = ["=== USER CONSTRAINTS (MUST shape every stop recommendation) ==="];
  buildTripConstraints(answers, routeInfo).forEach(({ label, value }) => {
    lines.push(`${label}: ${value}`);
  });

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

  const schedule = getScheduleRestrictionLabels(answers);
  if (schedule.some(s => /Saturday|Sabbath/i.test(s))) {
    lines.push("MUST: Do not schedule driving segments on Saturday — place overnight stop before Sabbath begins.");
  }
  if (schedule.some(s => /Sunday/i.test(s))) {
    lines.push("MUST: Do not schedule driving segments on Sunday.");
  }

  lines.push("If placesContext lists verified business names, use those exact names — never invent alternatives.");
  return lines.join("\n");
}
