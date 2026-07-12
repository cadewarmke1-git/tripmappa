/** Parse Google DirectionsResult (and polyline fallbacks) into navigation steps. */

function stripHtml(html = "") {
  return String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizePoint(p) {
  if (!p) return null;
  const lat = typeof p.lat === "function" ? p.lat() : p.lat;
  const lng = typeof p.lng === "function" ? p.lng() : p.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function extractStepPath(step) {
  if (!step?.path?.length) return [];
  return step.path.map(normalizePoint).filter(Boolean);
}

/**
 * Flat navigation steps from DirectionsResult.
 * @returns {Array<{ instruction, roadName, distanceMeters, durationSeconds, start, end, path, maneuver }>}
 */
export function parseDirectionsSteps(directionsResult) {
  if (!directionsResult?.routes?.[0]?.legs) return [];

  const steps = [];
  for (const leg of directionsResult.routes[0].legs) {
    for (const step of leg.steps || []) {
      const path = extractStepPath(step);
      const start = normalizePoint(step.start_location);
      const end = normalizePoint(step.end_location);
      steps.push({
        instruction: stripHtml(step.instructions || "Continue"),
        roadName: step.road_name || step.street || "",
        distanceMeters: step.distance?.value ?? 0,
        durationSeconds: step.duration?.value ?? 0,
        start,
        end,
        path: path.length ? path : (start && end ? [start, end] : []),
        maneuver: step.maneuver || null,
      });
    }
  }
  return steps;
}

/** Build simplified steps from a bare polyline (HERE truck / no Directions API). */
export function buildPolylineSteps(routePoints = [], segmentMeters = 8000) {
  const points = routePoints.map(normalizePoint).filter(Boolean);
  if (points.length < 2) return [];

  const steps = [];
  let chunkStart = 0;
  let chunkDist = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const seg = haversineChunk(prev, curr);
    chunkDist += seg;

    if (chunkDist >= segmentMeters || i === points.length - 1) {
      const path = points.slice(chunkStart, i + 1);
      steps.push({
        instruction: i === points.length - 1 ? "Arrive at destination" : "Continue on route",
        roadName: "",
        distanceMeters: Math.round(chunkDist),
        durationSeconds: Math.round(chunkDist / 22),
        start: path[0],
        end: path[path.length - 1],
        path,
        maneuver: null,
      });
      chunkStart = i;
      chunkDist = 0;
    }
  }
  return steps;
}

function haversineChunk(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Full route polyline from steps or overview. */
export function buildRoutePolyline(directionsResult, routePoints = []) {
  const fromDirections = parseDirectionsSteps(directionsResult);
  if (fromDirections.length) {
    const path = [];
    for (const step of fromDirections) {
      for (const p of step.path) {
        const last = path[path.length - 1];
        if (!last || last.lat !== p.lat || last.lng !== p.lng) path.push(p);
      }
    }
    if (path.length >= 2) return path;
  }
  return routePoints.map(normalizePoint).filter(Boolean);
}

/** Maneuver icon key from Google maneuver string. */
export function maneuverIconKey(maneuver) {
  if (!maneuver) return "straight";
  const m = String(maneuver).toLowerCase();
  if (m.includes("left") && m.includes("u")) return "u-turn-left";
  if (m.includes("right") && m.includes("u")) return "u-turn-right";
  if (m.includes("sharp-left")) return "sharp-left";
  if (m.includes("sharp-right")) return "sharp-right";
  if (m.includes("slight-left") || m.includes("bear-left")) return "slight-left";
  if (m.includes("slight-right") || m.includes("bear-right")) return "slight-right";
  if (m.includes("left")) return "left";
  if (m.includes("right")) return "right";
  if (m.includes("roundabout") || m.includes("rotary")) return "roundabout";
  if (m.includes("merge")) return "merge";
  if (m.includes("fork")) return "fork";
  if (m.includes("ramp")) return "ramp";
  return "straight";
}
