import { describe, expect, it } from "vitest";
import {
  getDietarySearchKeywords,
  needsSafeStopsOnly,
  needsTowingQuestion,
} from "./tripAccommodations.js";

describe("tripAccommodations preferences", () => {
  it("detects safe stops preference and family accessibility", () => {
    expect(needsSafeStopsOnly({ preferences: ["Safe, well-lit stops only"] })).toBe(true);
    expect(needsSafeStopsOnly({ accessibility: ["Traveling with young children"] })).toBe(true);
    expect(needsSafeStopsOnly({ preferences: ["Scenic route"] })).toBe(false);
  });

  it("maps all selected dietary choices to search keywords", () => {
    const keys = getDietarySearchKeywords({
      dietary: ["Halal", "Kosher", "Pescatarian"],
    });
    expect(keys).toEqual([
      "halal restaurant",
      "kosher restaurant",
      "seafood restaurant",
    ]);
  });

  it("always asks towing for rental car regardless of distance", () => {
    expect(needsTowingQuestion({ vehicle: "Rental Car" }, { routeDistanceMiles: 20 })).toBe(true);
    expect(needsTowingQuestion({ vehicle: "Rental Car" }, {})).toBe(true);
  });

  it("asks motorcycle towing at 80 miles or more", () => {
    expect(needsTowingQuestion({ vehicle: "Motorcycle" }, { routeDistanceMiles: 79 })).toBe(false);
    expect(needsTowingQuestion({ vehicle: "Motorcycle" }, { routeDistanceMiles: 80 })).toBe(true);
    expect(needsTowingQuestion({ vehicle: "Motorcycle" }, { routeDistanceMiles: 100 })).toBe(true);
  });
});
