import { beforeEach, describe, expect, it } from "vitest";
import {
  resetPlacesBudget,
  recordNearbyCalls,
  getNearbyCallCount,
  canMakeNearbyCall,
  MAX_NEARBY_PER_TRIP,
} from "./placesBudget.js";

describe("placesBudget recordNearbyCalls", () => {
  beforeEach(() => {
    resetPlacesBudget();
  });

  it("counts server resolve Nearby against the 15-call budget", () => {
    expect(getNearbyCallCount()).toBe(0);
    recordNearbyCalls(3);
    expect(getNearbyCallCount()).toBe(3);
    expect(canMakeNearbyCall()).toBe(true);
    recordNearbyCalls(12);
    expect(getNearbyCallCount()).toBe(MAX_NEARBY_PER_TRIP);
    expect(canMakeNearbyCall()).toBe(false);
  });

  it("ignores zero / invalid billed counts", () => {
    recordNearbyCalls(0);
    recordNearbyCalls(-2);
    recordNearbyCalls(null);
    expect(getNearbyCallCount()).toBe(0);
  });
});
