/** Short uppercase labels for the plan-flow answer sidebar. */
export const QUESTION_SIDEBAR_LABELS = {
  vehicle: "VEHICLE",
  primary_vehicle: "VEHICLE",
  fuel_type: "FUEL",
  towing: "TOWING",
  multi_vehicles: "VEHICLES",
  travelers: "TRAVELERS",
  party_composition: "PARTY",
  adult_count: "ADULTS",
  child_count: "CHILDREN",
  stop_count: "STOPS",
  stop_frequency: "PACE",
  luxury_level: "BUDGET",
  overnight_preference: "DRIVE",
  lodging: "LODGING",
  trip_nights: "NIGHTS",
  loyalty_program: "LOYALTY",
  dietary: "DIETARY",
  food_allergies: "ALLERGIES",
  accessibility: "ACCESS",
  stops_interests: "STOPS",
  trip_budget: "BUDGET",
  schedule_restrictions: "SCHEDULE",
  schedule_drive_hours: "HOURS",
  what_matters: "MATTERS",
  preferences: "PREFS",
  hauling_type: "HAULING",
  sleeper_cab: "SLEEPER",
  truck_stop_brand: "STOPS",
  route_restrictions: "ROUTE",
  coordination_needs: "COORD",
  kids_ages: "KIDS",
};

export function getQuestionFlowSidebarLabel(question) {
  const id = question?.id;
  if (id && QUESTION_SIDEBAR_LABELS[id]) return QUESTION_SIDEBAR_LABELS[id];
  const ask = (question?.ask || "").trim().replace(/\?+$/, "");
  if (!ask) return "ANSWER";
  return ask.split(/\s+/).slice(0, 2).join(" ").toUpperCase();
}
