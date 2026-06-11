import { describe, expect, it } from "vitest";
import { isNationalChainPlace, TOP_US_RESTAURANT_CHAINS } from "./nationalRestaurantChains.js";

describe("nationalRestaurantChains", () => {
  it("lists 50 top US chains", () => {
    expect(TOP_US_RESTAURANT_CHAINS.length).toBe(50);
  });

  it("detects major chains", () => {
    expect(isNationalChainPlace({ name: "McDonald's", address: "123 Main St" })).toBe(true);
    expect(isNationalChainPlace({ name: "Chipotle Mexican Grill" })).toBe(true);
    expect(isNationalChainPlace({ name: "The Local Fork", address: "Nashville TN" })).toBe(false);
  });
});
