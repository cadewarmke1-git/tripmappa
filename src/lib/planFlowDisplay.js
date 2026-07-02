/** Display-only labels for plan flow option cards — does not affect flow logic. */

export const VEHICLE_OPTION_DESCRIPTIONS = {
  Car: "Sedan, coupe, hatchback",
  Motorcycle: "Two wheels, open road",
  "SUV or Van": "Crossovers and full-size",
  "Rental Car": "Check mileage limits on your agreement",
  RV: "Motorhome or towable coach",
  "Camper Van": "Van conversion or Class B",
  "Semi Truck (18-wheeler)": "Class 8 freight hauler",
  Flatbed: "Open deck commercial",
  Tanker: "Liquid or bulk cargo",
  "Box Truck": "Straight truck, local/regional",
  Boat: "Trailered or marina legs",
  Ferry: "Water crossing segment",
  Plane: "Fly + drive combo",
  "Multi-Vehicle Trip": "Several vehicles, one convoy",
};

/** Vehicle groups hidden until "+ More vehicle types" is expanded. */
export const VEHICLE_EXPANDER_GROUP_LABELS = new Set(["Commercial", "Other", ""]);

export function vehicleOptionDescription(value, label) {
  if (VEHICLE_OPTION_DESCRIPTIONS[value]) return VEHICLE_OPTION_DESCRIPTIONS[value];
  const dash = String(label || "").indexOf("—");
  if (dash > 0) return String(label).slice(dash + 1).trim();
  return null;
}

export function splitVehicleGroups(groups = []) {
  const primary = [];
  const expanded = [];
  for (const group of groups) {
    if (VEHICLE_EXPANDER_GROUP_LABELS.has(group.label)) expanded.push(group);
    else primary.push(group);
  }
  return { primary, expanded };
}
