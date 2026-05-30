import { describe, expect, it } from "vitest";
import {
  getDietarySearchKeywords,
  needsSafeStopsOnly,
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
});
