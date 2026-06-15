import { DIETARY_PREFERENCE_CHOICES } from "./tripAccommodations.js";

/** Dietary multiselect — shared by onboarding and profile preferences. */
export const TRAVELER_DIETARY_OPTIONS = [...DIETARY_PREFERENCE_CHOICES];

/**
 * Stop interest multiselect — grouped for display; flat list matches profile + trip flow.
 * Every option appears exactly once across groups.
 */
export const TRAVELER_STOPS_INTEREST_GROUPS = [
  {
    id: "outdoors",
    label: "Outdoors & nature",
    options: [
      "National Parks or Nature",
      "Beaches",
      "Amusement Parks",
    ],
  },
  {
    id: "entertainment",
    label: "Entertainment",
    options: [
      "Casinos",
      "Sports Venues",
      "Music Venues",
      "Comedy clubs or sports bars",
      "Drive-In Movie Theaters",
    ],
  },
  {
    id: "culture",
    label: "Culture & landmarks",
    options: [
      "Landmarks or Historical Sites",
      "Antique Shops or Flea Markets",
      "Prayer facilities",
    ],
  },
  {
    id: "shopping_work",
    label: "Shopping & stops",
    options: [
      "Shopping Malls or Outlets",
      "Remote work — WiFi cafés",
      "No specific interests",
    ],
  },
];

export const TRAVELER_STOPS_INTEREST_OPTIONS = TRAVELER_STOPS_INTEREST_GROUPS.flatMap(
  group => group.options,
);
