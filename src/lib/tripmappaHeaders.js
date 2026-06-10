/** Standard headers for TripMappa frontend API calls. */
export function tripMappaApiHeaders(extra = {}) {
  return {
    "x-tripmappa-client": "web",
    ...extra,
  };
}
