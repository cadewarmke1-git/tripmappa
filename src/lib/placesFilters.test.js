import { describe, expect, it } from "vitest";
import {
  allowsNationalChains,
  filterGenericChains,
  filterLodgingByTier,
  filterRatingBand,
  sortLodgingByLoyalty,
} from "./placesFilters.js";

describe("placesFilters lodging", () => {
  const places = [
    { name: "Budget Inn", priceLevel: 0, rating: 3.2 },
    { name: "Marriott Downtown", priceLevel: 3, rating: 4.5 },
    { name: "Luxury Resort", priceLevel: 4, rating: 4.8 },
  ];

  it("filters by lodging tier preference", () => {
    const budget = filterLodgingByTier(places, { lodging: "Budget" });
    expect(budget.some(p => /Budget Inn/i.test(p.name))).toBe(true);
    expect(budget.some(p => /Luxury/i.test(p.name))).toBe(false);
  });

  it("prioritizes loyalty brand matches", () => {
    const sorted = sortLodgingByLoyalty(places, { loyalty_program: "Marriott Bonvoy" });
    expect(sorted[0].name).toMatch(/Marriott/i);
  });

  it("filters national chains unless drive-through is selected", () => {
    const mixed = [
      { name: "McDonald's", rating: 4.3, userRatingsTotal: 200 },
      { name: "Blue Mesa Grill", rating: 4.5, userRatingsTotal: 400 },
    ];
    const filtered = filterGenericChains(mixed, { allowChains: false });
    expect(filtered.some(p => /Blue Mesa/i.test(p.name))).toBe(true);
    expect(filtered.some(p => /McDonald/i.test(p.name))).toBe(false);
    expect(allowsNationalChains({ dietary: ["Drive-Through Only"] })).toBe(true);
    expect(filterGenericChains(mixed, { allowChains: true }).length).toBe(2);
  });

  it("prefers rating 4.2+ with 50–5000 reviews", () => {
    const places = [
      { name: "Local Gem", rating: 4.6, userRatingsTotal: 220 },
      { name: "Mega Chain", rating: 4.8, userRatingsTotal: 12000 },
      { name: "New Spot", rating: 4.0, userRatingsTotal: 8 },
    ];
    const filtered = filterRatingBand(places);
    expect(filtered.map(p => p.name)).toEqual(["Local Gem"]);
  });
});
