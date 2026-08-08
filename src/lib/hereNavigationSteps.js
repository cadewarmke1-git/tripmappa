/** Parse HERE Routing v8 actions into cockpit navigation steps. */
import { decodeFlexiblePolyline } from "./hereFlexiblePolyline.js";

/**
 * Map HERE action + direction → Google-style maneuver strings the cockpit icons understand.
 */
export function hereActionToManeuver(action = {}, instruction = "") {
  const type = String(action.action || "").toLowerCase();
  const dir = String(action.direction || "").toLowerCase();
  const blob = `${type} ${dir} ${instruction}`.toLowerCase();

  if (type === "arrive" || type === "depart") return null;
  if (/(u-?turn|uturn)/i.test(blob)) {
    if (dir.includes("left") || /left/.test(blob)) return "u-turn-left";
    if (dir.includes("right") || /right/.test(blob)) return "u-turn-right";
    return "u-turn-left";
  }
  if (type === "roundaboutEnter" || type === "roundaboutExit" || /roundabout|rotary/.test(blob)) {
    return "roundabout";
  }
  if (type === "exitRoundabout") return "roundabout";
  if (type === "ramp" || /take (the )?ramp|onto the ramp/.test(blob)) return "ramp";
  if (type === "merge" || /\bmerge\b/.test(blob)) return "merge";
  if (type === "fork" || /\bfork\b/.test(blob)) return "fork";
  if (type === "keep") {
    if (dir === "left" || /keep left|bear left/.test(blob)) return "slight-left";
    if (dir === "right" || /keep right|bear right/.test(blob)) return "slight-right";
    return "straight";
  }
  if (type === "turn" || type === "sharp" || dir) {
    if (dir === "left" || dir === "middleLeft") {
      if (/sharp/.test(blob)) return "sharp-left";
      if (/slight|bear|light/.test(blob) || action.severity === "light") return "slight-left";
      return "left";
    }
    if (dir === "right" || dir === "middleRight") {
      if (/sharp/.test(blob)) return "sharp-right";
      if (/slight|bear|light/.test(blob) || action.severity === "light") return "slight-right";
      return "right";
    }
  }
  if (type === "continue" || type === "straight") return "straight";
  if (/turn left|left onto/.test(blob)) return "left";
  if (/turn right|right onto/.test(blob)) return "right";
  return "straight";
}

function extractRoadName(action = {}, instruction = "") {
  const fromNext = action.nextRoad?.name?.[0]?.value
    || action.nextRoad?.number?.[0]?.value
    || action.currentRoad?.name?.[0]?.value
    || action.currentRoad?.number?.[0]?.value;
  if (fromNext) return String(fromNext);
  const m = String(instruction).match(/\b(?:onto|on|toward)\s+([^.,]+)/i);
  return m ? m[1].trim() : "";
}

function pointAtOffset(sectionPoints, offset) {
  if (!sectionPoints?.length) return null;
  const idx = Math.max(0, Math.min(sectionPoints.length - 1, Number(offset) || 0));
  const p = sectionPoints[idx];
  return p ? { lat: p.lat, lng: p.lng } : null;
}

function pathBetweenOffsets(sectionPoints, startOffset, endOffset) {
  if (!sectionPoints?.length) return [];
  const a = Math.max(0, Math.min(sectionPoints.length - 1, Number(startOffset) || 0));
  const b = Math.max(a, Math.min(sectionPoints.length - 1, Number(endOffset) || a));
  return sectionPoints.slice(a, b + 1).map((p) => ({ lat: p.lat, lng: p.lng }));
}

/**
 * Flatten HERE routes[0].sections[].actions into cockpit steps.
 * Handles multi-section (via waypoint) truck routes.
 *
 * @returns {Array<{ instruction, roadName, distanceMeters, durationSeconds, start, end, path, maneuver }>}
 */
export function parseHereRouteSteps(hereRoute) {
  const sections = hereRoute?.routes?.[0]?.sections;
  if (!Array.isArray(sections) || !sections.length) return [];

  const steps = [];

  for (const section of sections) {
    const sectionPoints = section.polyline
      ? decodeFlexiblePolyline(section.polyline)
      : [];
    const actions = Array.isArray(section.actions) && section.actions.length
      ? section.actions
      : (Array.isArray(section.turnByTurnActions) ? section.turnByTurnActions : []);

    if (!actions.length) continue;

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i] || {};
      const next = actions[i + 1];
      const instruction = String(action.instruction || "").trim()
        || defaultInstruction(action);
      if (!instruction && action.action === "depart" && !next) continue;

      const startOff = action.offset ?? 0;
      const endOff = next?.offset ?? startOff;
      const start = pointAtOffset(sectionPoints, startOff);
      const end = pointAtOffset(sectionPoints, endOff);
      const path = pathBetweenOffsets(sectionPoints, startOff, endOff);
      const roadName = extractRoadName(action, instruction);
      const maneuver = hereActionToManeuver(action, instruction);

      steps.push({
        instruction: instruction || "Continue on route",
        roadName,
        distanceMeters: Math.round(Number(action.length) || 0),
        durationSeconds: Math.round(Number(action.duration) || 0),
        start,
        end,
        path: path.length ? path : (start && end ? [start, end] : []),
        maneuver,
        source: "here",
      });
    }
  }

  return steps;
}

function defaultInstruction(action = {}) {
  const type = String(action.action || "");
  const dir = String(action.direction || "");
  if (type === "depart") return "Depart";
  if (type === "arrive") return "Arrive at destination";
  if (type === "continue") return "Continue on route";
  if (type === "turn" && dir) return `Turn ${dir}`;
  if (type === "keep" && dir) return `Keep ${dir}`;
  if (type) return type.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
  return "";
}

/** True when a HERE route payload has usable guidance actions. */
export function hereRouteHasGuidance(hereRoute) {
  const sections = hereRoute?.routes?.[0]?.sections;
  if (!sections?.length) return false;
  return sections.some((s) => (s.actions?.length > 0) || (s.turnByTurnActions?.length > 0));
}
