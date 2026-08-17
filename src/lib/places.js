function normalizePlaceText(value) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") || "";
}

function placeMatchesInput(place, input) {
  const needle = normalizePlaceText(input);
  if (!needle) return false;
  const candidates = [
    place.formatted_address,
    place.name,
    place.formattedAddress,
  ].filter(Boolean);
  return candidates.some(c => {
    const hay = normalizePlaceText(c);
    return hay === needle || hay.includes(needle) || needle.includes(hay.split(",")[0]);
  });
}

function getPlaceDetails(placeId) {
  return new Promise((resolve) => {
    const container = document.createElement("div");
    const placesService = new window.google.maps.places.PlacesService(container);
    placesService.getDetails(
      { placeId, fields: ["formatted_address", "geometry", "place_id", "name"] },
      (detail, status) => {
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !detail?.geometry) {
          resolve(null);
          return;
        }
        resolve({
          formattedAddress: detail.formatted_address || detail.name,
          placeId: detail.place_id,
        });
      },
    );
  });
}

function getPlacePredictionsOnce(service, request) {
  return new Promise((resolve) => {
    service.getPlacePredictions(request, (predictions, status) => {
      if (status !== window.google.maps.places.PlacesServiceStatus.OK || !predictions?.length) {
        resolve(null);
        return;
      }
      resolve(predictions);
    });
  });
}

/** Legacy Autocomplete allows only one type — mixing geocode+establishment is INVALID_REQUEST. */
export const PLACES_ADDRESS_AUTOCOMPLETE_OPTIONS = { types: ["geocode"] };

/** Hide Google Places dropdowns appended to document.body (pac-container). */
export function dismissGooglePlacesDropdown() {
  if (typeof document === "undefined") return;
  document.querySelectorAll(".pac-container").forEach(el => {
    el.style.display = "none";
  });
}

/** Request geometry + address fields from legacy Autocomplete widgets when supported. */
export function configurePlacesAutocomplete(autocompleteInstance) {
  autocompleteInstance?.setFields?.([
    "formatted_address",
    "geometry",
    "place_id",
    "name",
  ]);
}

/** Google Directions waypoint from a resolved place, falling back to free text. */
export function toDirectionsWaypoint(resolved, fallbackText) {
  if (resolved?.placeId) return { placeId: resolved.placeId };
  return resolved?.formattedAddress || fallbackText;
}

export function isSameResolvedPlace(fromPlace, toPlace, fromText, toText) {
  if (fromPlace?.placeId && toPlace?.placeId && fromPlace.placeId === toPlace.placeId) return true;
  const from = normalizePlaceText(fromPlace?.formattedAddress || fromText);
  const to = normalizePlaceText(toPlace?.formattedAddress || toText);
  return Boolean(from && to && from === to);
}

export function looksLikeLatLng(text) {
  return /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(String(text || "").trim());
}

/** Resolve free-text or Autocomplete selection to a verified Places result. */
export function resolvePlaceFromAutocomplete(input, autocompleteInstance) {
  const text = input?.trim();
  if (!text || !window.google?.maps?.places) return Promise.resolve(null);

  if (autocompleteInstance) {
    const selected = autocompleteInstance.getPlace();
    if (selected?.place_id && placeMatchesInput(selected, text)) {
      if (selected.geometry) {
        return Promise.resolve({
          formattedAddress: selected.formatted_address || text,
          placeId: selected.place_id,
        });
      }
      return getPlaceDetails(selected.place_id);
    }
  }

  return (async () => {
    const service = new window.google.maps.places.AutocompleteService();
    let predictions = await getPlacePredictionsOnce(service, { input: text, types: ["geocode"] });
    if (!predictions) {
      predictions = await getPlacePredictionsOnce(service, { input: text });
    }
    if (!predictions?.length) return null;

    const exact = predictions.find(p => normalizePlaceText(p.description) === normalizePlaceText(text));
    const match = exact || predictions[0];
    return getPlaceDetails(match.place_id);
  })();
}
