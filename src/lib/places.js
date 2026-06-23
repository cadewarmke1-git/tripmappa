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

  return new Promise((resolve) => {
    const service = new window.google.maps.places.AutocompleteService();
    service.getPlacePredictions(
      { input: text, types: ["geocode", "establishment"] },
      async (predictions, status) => {
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !predictions?.length) {
          resolve(null);
          return;
        }

        const exact = predictions.find(p => normalizePlaceText(p.description) === normalizePlaceText(text));
        const match = exact || predictions[0];
        const details = await getPlaceDetails(match.place_id);
        resolve(details);
      },
    );
  });
}
