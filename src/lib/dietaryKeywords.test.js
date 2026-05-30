import { describe, expect, it } from "vitest";
import { dietaryMatchesRestaurant } from "./dietaryKeywords.js";

describe("client dietaryKeywords", () => {
  it("filters restaurants by dietary preference on the client", () => {
    expect(dietaryMatchesRestaurant({ name: "Halal Kitchen" }, { dietary: ["Halal"] })).toBe(true);
    expect(dietaryMatchesRestaurant({ name: "Steakhouse" }, { dietary: ["Halal"] })).toBe(false);
    expect(dietaryMatchesRestaurant({ name: "Any Place" }, { dietary: ["No restrictions"] })).toBe(true);
  });
});
