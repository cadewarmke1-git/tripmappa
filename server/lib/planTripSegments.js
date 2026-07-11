/** Multi-day trip segment construction and result stitching for parallel Sonnet calls. */

const TRIP_NIGHTS_RE = /(\d+)/;
const MAX_PARALLEL_SEGMENTS = 4;

export function parseTripNights(tripNights) {
  if (!tripNights) return 0;
  const m = String(tripNights).match(TRIP_NIGHTS_RE);
  return m ? parseInt(m[1], 10) : 0;
}

function dedupeConsecutive(items) {
  const out = [];
  for (const item of items) {
    if (!item) continue;
    if (out.length === 0 || out[out.length - 1] !== item) out.push(item);
  }
  return out;
}

function cityKey(value) {
  return String(value || "").trim().toLowerCase();
}

function cityMatches(a, b) {
  const ak = cityKey(a);
  const bk = cityKey(b);
  if (!ak || !bk) return false;
  if (ak === bk) return true;
  const aCity = ak.split(",")[0].trim();
  const bCity = bk.split(",")[0].trim();
  return ak.includes(bCity) || bk.includes(aCity);
}

/**
 * True when the trip should use parallel per-leg Sonnet calls (1+ overnight stops).
 */
export function shouldUseParallelTripSegments({ answers, routeInfo, isSimplifiedFormat, continuousDrive }) {
  if (isSimplifiedFormat || continuousDrive) return false;
  const nights = parseTripNights(answers?.trip_nights);
  if (nights < 1) return false;
  const cities = Array.isArray(routeInfo?.citiesAlongRoute)
    ? routeInfo.citiesAlongRoute.filter(Boolean)
    : [];
  return cities.length >= 2;
}

/**
 * Split a multi-day route into up to 4 parallel overnight legs.
 * @returns {Array<{ segmentIndex, origin, destination, citiesAlongRoute, isFirstSegment, isLastSegment, overnightCount, totalSegments }>}
 */
export function buildTripSegments(routeInfo, answers, tripOrigin, tripDestination) {
  const nights = parseTripNights(answers?.trip_nights);
  if (nights < 1) return [];

  let cities = Array.isArray(routeInfo?.citiesAlongRoute)
    ? routeInfo.citiesAlongRoute.filter(Boolean).map(String)
    : [];
  if (cities.length < 2) return [];

  const origin = String(tripOrigin || routeInfo?.origin || cities[0]).trim();
  const destination = String(tripDestination || routeInfo?.destination || cities[cities.length - 1]).trim();

  if (!cityMatches(cities[0], origin)) cities.unshift(origin);
  if (!cityMatches(cities[cities.length - 1], destination)) cities.push(destination);
  cities = dedupeConsecutive(cities);

  const segmentCount = nights === 1 ? 2 : Math.min(nights, MAX_PARALLEL_SEGMENTS);
  if (segmentCount < 2) return [];

  const segments = [];

  if (nights === 1) {
    const overnightIdx = Math.max(1, Math.round((cities.length - 1) / 2));
    const legBoundaries = [
      { startIdx: 0, endIdx: overnightIdx },
      { startIdx: overnightIdx, endIdx: cities.length - 1 },
    ];
    for (let i = 0; i < legBoundaries.length; i++) {
      const { startIdx, endIdx } = legBoundaries[i];
      const subset = cities.slice(startIdx, endIdx + 1);
      segments.push({
        segmentIndex: i,
        origin: subset[0],
        destination: subset[subset.length - 1],
        citiesAlongRoute: subset,
        isFirstSegment: i === 0,
        isLastSegment: i === legBoundaries.length - 1,
        overnightCount: 1,
        totalSegments: legBoundaries.length,
      });
    }
  } else {
    const boundaryIndices = [];
    for (let i = 0; i < segmentCount; i++) {
      boundaryIndices.push(Math.round((i / segmentCount) * (cities.length - 1)));
    }
    boundaryIndices[0] = 0;
    boundaryIndices[segmentCount - 1] = cities.length - 1;

    for (let i = 0; i < segmentCount; i++) {
      const startIdx = boundaryIndices[i];
      const endIdx = i === segmentCount - 1 ? cities.length - 1 : boundaryIndices[i + 1];
      if (endIdx < startIdx) continue;
      const subset = cities.slice(startIdx, endIdx + 1);
      if (subset.length < 2 && !segments.length) {
        subset.push(destination);
      }
      segments.push({
        segmentIndex: i,
        origin: subset[0],
        destination: subset[subset.length - 1],
        citiesAlongRoute: subset,
        isFirstSegment: i === 0,
        isLastSegment: i === segmentCount - 1,
        overnightCount: 1,
        totalSegments: segmentCount,
      });
    }
  }

  if (segments.length >= 2) {
    segments[segments.length - 1].destination = destination;
    const last = segments[segments.length - 1];
    if (!cityMatches(last.citiesAlongRoute[last.citiesAlongRoute.length - 1], destination)) {
      last.citiesAlongRoute = dedupeConsecutive([...last.citiesAlongRoute, destination]);
    }
  }

  return segments.length >= 2 ? segments : [];
}

function parseDistanceMiles(value) {
  if (value == null || value === "") return Number.NaN;
  const m = String(value).match(/([\d,.]+)/);
  return m ? parseFloat(m[1].replace(/,/g, "")) : Number.NaN;
}

function normalizeStopNameKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function stopCoordinates(stop) {
  const lat = stop?.lat ?? stop?.latitude;
  const lng = stop?.lng ?? stop?.longitude;
  if (lat == null || lng == null) return null;
  return { lat: Number(lat), lng: Number(lng) };
}

function consecutiveStopsDuplicate(a, b) {
  if (!a || !b) return false;
  const nameA = normalizeStopNameKey(a.name || a.city || a.location);
  const nameB = normalizeStopNameKey(b.name || b.city || b.location);
  if (nameA && nameB && nameA === nameB && nameA.length >= 4) return true;
  const coordsA = stopCoordinates(a);
  const coordsB = stopCoordinates(b);
  if (coordsA && coordsB) {
    return haversineMiles(coordsA.lat, coordsA.lng, coordsB.lat, coordsB.lng) < 0.5;
  }
  return false;
}

export function dedupeConsecutiveStops(stops = []) {
  const out = [];
  for (const stop of stops) {
    if (!stop) continue;
    if (out.length && consecutiveStopsDuplicate(out[out.length - 1], stop)) continue;
    out.push(stop);
  }
  return out;
}

export function assertNoConsecutiveDuplicateStops(stops = []) {
  for (let i = 1; i < stops.length; i++) {
    if (consecutiveStopsDuplicate(stops[i - 1], stops[i])) {
      throw new Error(`Consecutive duplicate stops remain after stitching at index ${i}`);
    }
  }
}

function mergeRoadStopsInOrder(segmentResults) {
  const merged = segmentResults.flatMap((result) =>
    (Array.isArray(result?.road_stops) ? result.road_stops : []),
  );
  return merged
    .filter(Boolean)
    .sort((a, b) => {
      const aDist = parseDistanceMiles(a?.distance);
      const bDist = parseDistanceMiles(b?.distance);
      if (!Number.isNaN(aDist) && !Number.isNaN(bDist) && aDist !== bDist) return aDist - bDist;
      return 0;
    });
}

function dedupeStringList(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = String(item || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/**
 * Combine parallel segment JSON into one trip response.
 * @param {object[]} segmentResults Parsed segment payloads in order
 */
export function stitchTripSegments(segmentResults) {
  if (!Array.isArray(segmentResults) || segmentResults.length === 0) {
    throw new Error("No segment results to stitch");
  }

  const first = { ...segmentResults[0] };
  const stops = dedupeConsecutiveStops(segmentResults.flatMap((result) =>
    (Array.isArray(result?.stops) ? result.stops : []),
  ));
  const road_stops = dedupeConsecutiveStops(mergeRoadStopsInOrder(segmentResults));
  assertNoConsecutiveDuplicateStops(road_stops);
  assertNoConsecutiveDuplicateStops(stops);
  const tips = dedupeStringList(segmentResults.flatMap((result) =>
    (Array.isArray(result?.tips) ? result.tips : []),
  ));
  const road_condition_warnings = dedupeStringList(segmentResults.flatMap((result) =>
    (Array.isArray(result?.road_condition_warnings) ? result.road_condition_warnings : []),
  ));

  return {
    ...first,
    trip_format: "multi_day",
    route_summary: first.route_summary || "",
    stops,
    road_stops,
    tips,
    road_condition_warnings,
  };
}
