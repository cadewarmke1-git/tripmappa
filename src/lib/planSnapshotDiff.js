/** Human-readable diff when plan inputs change after generation. */

const LABELS = {
  origin: "Origin",
  dest: "Destination",
  vehicle: "Vehicle",
  effective_vehicle: "Routing vehicle",
  primary_vehicle: "Primary vehicle",
  fuel_type: "Fuel type",
  towing: "Towing",
  travelers: "Travelers",
  overnight_preference: "Overnight plan",
  lodging: "Lodging",
  loyalty_program: "Hotel loyalty",
  trip_budget: "Budget",
  food_allergies: "Allergies",
  schedule_drive_hours: "Drive hours",
};

const ARRAY_KEYS = [
  "dietary", "accessibility", "preferences", "stops_interests",
  "schedule_restrictions", "multi_vehicles", "route_restrictions", "coordination_needs",
];

function parseSnapshot(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function fmtVal(val) {
  if (val == null || val === "") return "—";
  if (Array.isArray(val)) return val.length ? val.join(", ") : "None";
  return String(val);
}

function diffField(label, before, after) {
  const b = fmtVal(before);
  const a = fmtVal(after);
  if (b === a) return null;
  return `${label}: ${b} → ${a}`;
}

export function describePlanChanges(savedSnapshot, currentSnapshot, max = 4) {
  const saved = parseSnapshot(savedSnapshot);
  const current = parseSnapshot(currentSnapshot);
  if (!saved || !current) return [];

  const changes = [];
  if (saved.origin !== current.origin) {
    changes.push(diffField("Origin", saved.origin, current.origin));
  }
  if (saved.dest !== current.dest) {
    changes.push(diffField("Destination", saved.dest, current.dest));
  }
  if (saved.routeDistance !== current.routeDistance || saved.routeDuration !== current.routeDuration) {
    changes.push(`Route: ${saved.routeDistance || "?"} / ${saved.routeDuration || "?"} → ${current.routeDistance || "?"} / ${current.routeDuration || "?"}`);
  }

  const sa = saved.answers || {};
  const ca = current.answers || {};
  Object.keys(LABELS).forEach((key) => {
    const line = diffField(LABELS[key], sa[key], ca[key]);
    if (line) changes.push(line);
  });
  ARRAY_KEYS.forEach((key) => {
    const line = diffField(LABELS[key] || key.replace(/_/g, " "), sa[key], ca[key]);
    if (line) changes.push(line);
  });

  return changes.filter(Boolean).slice(0, max);
}
