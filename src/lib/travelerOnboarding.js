export {
  TRAVELER_DIETARY_OPTIONS,
  TRAVELER_STOPS_INTEREST_GROUPS,
  TRAVELER_STOPS_INTEREST_OPTIONS,
} from "./travelerPreferenceOptions.js";

export function travelerProfileToFlowPrefill(travelerProfile = {}) {
  if (!travelerProfile || typeof travelerProfile !== "object") return {};
  const out = {};
  if (Array.isArray(travelerProfile.dietary) && travelerProfile.dietary.length) {
    out.dietary = [...travelerProfile.dietary];
  }
  if (travelerProfile.food_allergies?.trim()) {
    out.food_allergies = travelerProfile.food_allergies.trim();
  }
  if (Array.isArray(travelerProfile.stops_interests) && travelerProfile.stops_interests.length) {
    out.stops_interests = [...travelerProfile.stops_interests];
  }
  return out;
}
