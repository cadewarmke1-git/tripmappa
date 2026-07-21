/** Human-readable diff when plan inputs change after generation. */

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

/**
 * UI change list for stale banner (kept for tests / tooling).
 * Snapshots only carry origin, dest, and vehicle.
 */
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
  const savedVehicle = saved.vehicle ?? saved.answers?.effective_vehicle ?? saved.answers?.vehicle;
  const currentVehicle = current.vehicle ?? current.answers?.effective_vehicle ?? current.answers?.vehicle;
  if (String(savedVehicle || "").toLowerCase() !== String(currentVehicle || "").toLowerCase()) {
    changes.push(diffField("Vehicle", savedVehicle, currentVehicle));
  }

  return changes.filter(Boolean).slice(0, max);
}

const REGENERATE_PHRASES = {
  vehicle: "Vehicle",
  effective_vehicle: "Routing vehicle",
  primary_vehicle: "Primary vehicle",
  fuel_type: "Fuel type",
  towing: "Towing",
  travelers: "Party size",
  overnight_preference: "Overnight preference",
  lodging: "Lodging",
  loyalty_program: "Hotel loyalty",
  trip_budget: "Budget",
  food_allergies: "Food allergies",
  schedule_drive_hours: "Travel hours",
  dietary: "Dietary restrictions",
  accessibility: "Accessibility",
  preferences: "Route preferences",
  stops_interests: "Stop interests",
  schedule_restrictions: "Schedule",
  multi_vehicles: "Vehicles on trip",
  route_restrictions: "Route restrictions",
  coordination_needs: "Coordination",
};

const ARRAY_KEYS = [
  "dietary", "accessibility", "preferences", "stops_interests",
  "schedule_restrictions", "multi_vehicles", "route_restrictions", "coordination_needs",
];

function asStringList(val) {
  if (val == null || val === "") return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return [String(val)];
}

function describeScalarRegenerateChange(key, before, after) {
  const label = REGENERATE_PHRASES[key] || key.replace(/_/g, " ");
  const b = fmtVal(before);
  const a = fmtVal(after);
  if (b === a) return null;
  if (key === "overnight_preference") return `Overnight preference changed to ${a}`;
  if (b === "—" || b === "None") return `${label} set to ${a}`;
  if (a === "—" || a === "None") return `${label} cleared (was ${b})`;
  return `${label} changed from ${b} to ${a}`;
}

function describeArrayRegenerateChanges(key, before, after) {
  const label = REGENERATE_PHRASES[key] || key.replace(/_/g, " ");
  const bArr = asStringList(before);
  const aArr = asStringList(after);
  const added = aArr.filter(x => !bArr.includes(x));
  const removed = bArr.filter(x => !aArr.includes(x));
  const lines = [];
  added.forEach((item) => {
    if (key === "dietary") lines.push(`${item} dietary restriction added`);
    else if (key === "accessibility") lines.push(`${item} accessibility need added`);
    else if (key === "schedule_restrictions") lines.push(`${item} schedule constraint added`);
    else lines.push(`${item} added to ${label.toLowerCase()}`);
  });
  removed.forEach((item) => {
    lines.push(`${item} removed from ${label.toLowerCase()}`);
  });
  if (!lines.length && fmtVal(before) !== fmtVal(after)) {
    lines.push(`${label} changed from ${fmtVal(before)} to ${fmtVal(after)}`);
  }
  return lines;
}

/** Plain-English change list for Sonnet regenerate hints. */
export function describeRegenerateChanges(savedSnapshot, currentSnapshot, max = 8) {
  const saved = parseSnapshot(savedSnapshot);
  const current = parseSnapshot(currentSnapshot);
  if (!saved || !current) return [];

  const changes = [];
  if (saved.origin !== current.origin) {
    changes.push(describeScalarRegenerateChange("origin", saved.origin, current.origin));
  }
  if (saved.dest !== current.dest) {
    changes.push(describeScalarRegenerateChange("dest", saved.dest, current.dest));
  }

  const savedVehicle = saved.vehicle ?? saved.answers?.effective_vehicle ?? saved.answers?.vehicle;
  const currentVehicle = current.vehicle ?? current.answers?.effective_vehicle ?? current.answers?.vehicle;
  if (String(savedVehicle || "").toLowerCase() !== String(currentVehicle || "").toLowerCase()) {
    changes.push(describeScalarRegenerateChange("vehicle", savedVehicle, currentVehicle));
  }

  // Legacy full-answer snapshots (pre-tighten) still carry answers for regenerate hints.
  const sa = saved.answers || {};
  const ca = current.answers || {};
  if (Object.keys(sa).length || Object.keys(ca).length) {
    Object.keys(REGENERATE_PHRASES).forEach((key) => {
      if (key === "vehicle" || key === "effective_vehicle" || key === "primary_vehicle") return;
      if (ARRAY_KEYS.includes(key)) {
        changes.push(...describeArrayRegenerateChanges(key, sa[key], ca[key]));
      } else {
        changes.push(describeScalarRegenerateChange(key, sa[key], ca[key]));
      }
    });
  }

  return changes.filter(Boolean).slice(0, max);
}

function changeToDirective(change) {
  if (!change) return "";
  if (/added$/i.test(change) || /added to/i.test(change)) {
    return `Add or emphasize recommendations that reflect: ${change}`;
  }
  if (/removed from/i.test(change)) {
    return `Remove or de-emphasize stops tied to: ${change}`;
  }
  if (/changed from/i.test(change) || /changed to/i.test(change) || /set to/i.test(change)) {
    return `Rebuild affected stops and lodging for this change: ${change}`;
  }
  if (/cleared/i.test(change)) {
    return `Drop prior assumptions and replan without: ${change}`;
  }
  return `Adjust the plan for: ${change}`;
}

/** Block injected near top of generation hints on regenerate only. */
export function formatRegenerateDiffBlock(savedSnapshot, currentSnapshot, max = 8) {
  const changes = describeRegenerateChanges(savedSnapshot, currentSnapshot, max);
  if (!changes.length) return "";
  return [
    "REGENERATION DIRECTIVES (YOU MUST address every item — override the previous plan):",
    ...changes.map(c => `- YOU MUST: ${changeToDirective(c)}`),
    "",
    "Populate changes_made in your JSON with one bullet per directive above.",
  ].join("\n");
}
