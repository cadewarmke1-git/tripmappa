import { describe, expect, it } from "vitest";
import { filterLodgingByTier, sortLodgingByLoyalty } from "./placesFilters.js";

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
});
