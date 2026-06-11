import { describe, expect, it } from "vitest";
import {
  filterFoodCandidates,
  filterLodgingCandidates,
  isFoodServingPlace,
} from "./placesFilters.js";

describe("places type filters", () => {
  it("accepts restaurants with food-serving types", () => {
    expect(isFoodServingPlace({ types: ["restaurant", "food", "point_of_interest"] })).toBe(true);
    expect(isFoodServingPlace({ types: ["cafe", "food"] })).toBe(true);
  });

  it("rejects car dealers and hotels from food candidates", () => {
    expect(isFoodServingPlace({ types: ["car_dealer", "store"] })).toBe(false);
    expect(isFoodServingPlace({ types: ["lodging", "restaurant"] })).toBe(false);
    expect(isFoodServingPlace({ types: ["hotel", "point_of_interest"] })).toBe(false);
  });

  it("filterFoodCandidates removes non-food places", () => {
    const out = filterFoodCandidates([
      { name: "Ford", types: ["car_dealer"] },
      { name: "Bistro", types: ["restaurant", "food"] },
      { name: "Inn", types: ["lodging", "hotel"] },
    ]);
    expect(out.map(p => p.name)).toEqual(["Bistro"]);
  });

  it("filterLodgingCandidates keeps lodging types", () => {
    const out = filterLodgingCandidates([
      { name: "Holiday Inn", types: ["lodging", "hotel"] },
      { name: "Ford", types: ["car_dealer"] },
    ]);
    expect(out.map(p => p.name)).toEqual(["Holiday Inn"]);
  });
});
