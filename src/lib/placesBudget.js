/** Per-trip soft cap on live Google Places API calls during enrichment. */
const MAX_NEARBY_PER_TRIP = 15;
const MAX_DETAILS_PER_TRIP = 8;

let nearbyCount = 0;
let detailsCount = 0;
let capLogged = false;

export function resetPlacesBudget() {
  nearbyCount = 0;
  detailsCount = 0;
  capLogged = false;
}

function logCapHit(kind) {
  if (capLogged) return;
  capLogged = true;
  console.warn(`[places-budget] Per-trip ${kind} cap reached — serving cached/fallback data for remaining enrichment`);
}

export function canMakeNearbyCall() {
  if (nearbyCount >= MAX_NEARBY_PER_TRIP) {
    logCapHit("Nearby Search");
    return false;
  }
  return true;
}

export function recordNearbyCall() {
  nearbyCount += 1;
  if (nearbyCount >= MAX_NEARBY_PER_TRIP) logCapHit("Nearby Search");
}

export function canMakeDetailsCall() {
  if (detailsCount >= MAX_DETAILS_PER_TRIP) {
    logCapHit("Place Details");
    return false;
  }
  return true;
}

export function recordDetailsCall() {
  detailsCount += 1;
  if (detailsCount >= MAX_DETAILS_PER_TRIP) logCapHit("Place Details");
}
