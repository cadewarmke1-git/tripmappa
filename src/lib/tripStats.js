/** Aggregate stats from saved trips for the profile page. */

const STATE_SUFFIX = /,\s*([A-Z]{2})\b/;

function extractState(text) {
  if (!text) return null;
  const match = String(text).match(STATE_SUFFIX);
  return match ? match[1] : null;
}

function parseMiles(distanceStr) {
  if (!distanceStr) return 0;
  const match = String(distanceStr).replace(/,/g, "").match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

function collectStatesFromTrip(trip, states) {
  [trip.origin, trip.dest].forEach(loc => {
    const s = extractState(loc);
    if (s) states.add(s);
  });
  (trip.stops || []).forEach(stop => {
    const s = extractState(stop.city);
    if (s) states.add(s);
  });
  (trip.roadStops || []).forEach(stop => {
    const s = extractState(stop.location || stop.city);
    if (s) states.add(s);
  });
  (trip.routeInfo?.citiesAlongRoute || []).forEach(city => {
    const s = extractState(city);
    if (s) states.add(s);
  });
}

export function computeTripStats(trips = []) {
  const states = new Set();
  const vehicleCounts = {};
  let totalMiles = 0;

  for (const trip of trips) {
    collectStatesFromTrip(trip, states);
    totalMiles += parseMiles(trip.routeInfo?.distance);
    const vehicle = trip.answers?.vehicle || trip.routeInfo?.vehicleType || "Car";
    vehicleCounts[vehicle] = (vehicleCounts[vehicle] || 0) + 1;
  }

  const favoriteVehicle = Object.entries(vehicleCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  return {
    totalTrips: trips.length,
    milesPlanned: Math.round(totalMiles),
    statesVisited: states.size,
    favoriteVehicle,
  };
}

export function getTripVehicle(trip) {
  return trip.answers?.vehicle || trip.routeInfo?.vehicleType || "Car";
}
