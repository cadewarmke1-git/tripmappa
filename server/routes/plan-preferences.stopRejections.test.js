import { describe, expect, it } from "vitest";
import { sanitizeStopRejections, sanitizePreferences } from "../routes/plan-preferences.js";

describe("plan-preferences stop_rejections meta", () => {
  it("keeps category, type, and by_source maps", () => {
    expect(sanitizeStopRejections({
      categories: { fuel: 1, restaurant: 4 },
      types: { Steakhouse: 2 },
      by_source: {
        card_hide: { categories: { restaurant: 4 }, types: { Steakhouse: 2 } },
        itinerary_remove: { categories: { fuel: 1 }, types: {} },
      },
    })).toEqual({
      categories: { fuel: 1, restaurant: 4 },
      types: { Steakhouse: 2 },
      by_source: {
        itinerary_remove: { categories: { fuel: 1 }, types: {} },
        card_hide: { categories: { restaurant: 4 }, types: { Steakhouse: 2 } },
      },
    });
  });

  it("returns empty maps for garbage input", () => {
    expect(sanitizeStopRejections(null)).toEqual({
      categories: {},
      types: {},
      by_source: {
        itinerary_remove: { categories: {}, types: {} },
        card_hide: { categories: {}, types: {} },
      },
    });
  });
});

describe("plan-preferences ALLOWED_KEYS", () => {
  it("persists luxury_level like trip_budget", () => {
    expect(sanitizePreferences({
      trip_budget: "Over $1000",
      luxury_level: "4",
      unknown_field: "drop-me",
    })).toEqual({
      trip_budget: "Over $1000",
      luxury_level: "4",
    });
  });
});
