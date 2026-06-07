import { describe, expect, it } from "vitest";
import { formatPreferencesForPrompt } from "./user-trip-preferences.js";

describe("formatPreferencesForPrompt", () => {
  const samplePrefs = {
    stop_categories: { fuel: 4, restaurant: 2 },
    fuel_brands: { "Love's": 3 },
    restaurant_types: { BBQ: 2 },
    avg_stops_per_trip: 3.5,
    trip_count: 2,
  };

  const rollup = [
    "=== RECENT TRIP PREFERENCE SIGNALS (from saved trips — align suggestions with this history) ===",
    "Pet-friendly trips: 2 of last 2",
  ].join("\n");

  it("includes recentTripsPreferencesRollup when rollup data is provided", () => {
    const block = formatPreferencesForPrompt(samplePrefs, rollup);
    expect(block).toContain("USER LEARNED PREFERENCES");
    expect(block).toContain("Frequently added stop categories");
    expect(block).toContain("RECENT TRIP PREFERENCE SIGNALS");
    expect(block).toContain("Pet-friendly trips: 2 of last 2");
  });

  it("omits rollup gracefully when null or empty", () => {
    const withoutRollup = formatPreferencesForPrompt(samplePrefs, null);
    expect(withoutRollup).toContain("USER LEARNED PREFERENCES");
    expect(withoutRollup).not.toContain("RECENT TRIP PREFERENCE SIGNALS");

    const emptyRollup = formatPreferencesForPrompt(samplePrefs, "");
    expect(emptyRollup).not.toContain("RECENT TRIP PREFERENCE SIGNALS");
  });

  it("returns empty string when prefs and rollup are both absent", () => {
    expect(formatPreferencesForPrompt(null, null)).toBe("");
    expect(formatPreferencesForPrompt(null, "")).toBe("");
  });
});
