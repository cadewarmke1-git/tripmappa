import { describe, expect, it } from "vitest";
import { dietaryMatchesRestaurant, getDietarySearchKeywords } from "./dietaryKeywords.js";

describe("dietaryKeywords", () => {
  it("matches restaurants to selected dietary restrictions", () => {
    const ok = dietaryMatchesRestaurant(
      { name: "Halal Grill", types: ["restaurant"] },
      { dietary: ["Halal"] },
    );
    const bad = dietaryMatchesRestaurant(
      { name: "Steakhouse", types: ["steak_house"] },
      { dietary: ["Halal"] },
    );
    expect(ok).toBe(true);
    expect(bad).toBe(false);
  });

  it("builds allergy-aware search keywords", () => {
    const keys = getDietarySearchKeywords({
      dietary: ["Food Allergies — I will specify"],
      food_allergies: "peanut",
    });
    expect(keys[0]).toMatch(/peanut allergy friendly restaurant/i);
  });
});
