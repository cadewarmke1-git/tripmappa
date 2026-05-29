import { describe, expect, it } from "vitest";
import {
  TIERS,
  canUseGroceryDelivery,
  getTierLabel,
  getTierPriceLabel,
  hasUnlimitedTripGenerations,
  isAtLeastTier,
} from "./tiers.js";

describe("tiers", () => {
  it("ranks tiers correctly", () => {
    expect(isAtLeastTier(TIERS.FREE, TIERS.PREMIUM)).toBe(false);
    expect(isAtLeastTier(TIERS.PREMIUM, TIERS.PREMIUM)).toBe(true);
    expect(isAtLeastTier(TIERS.TRAVELER, TIERS.PREMIUM)).toBe(true);
    expect(isAtLeastTier(TIERS.PREMIUM, TIERS.TRAVELER)).toBe(false);
  });

  it("gates grocery to Traveler only", () => {
    expect(canUseGroceryDelivery(TIERS.FREE)).toBe(false);
    expect(canUseGroceryDelivery(TIERS.PREMIUM)).toBe(false);
    expect(canUseGroceryDelivery(TIERS.TRAVELER)).toBe(true);
  });

  it("gives unlimited generations to Premium and Traveler", () => {
    expect(hasUnlimitedTripGenerations(TIERS.FREE)).toBe(false);
    expect(hasUnlimitedTripGenerations(TIERS.PREMIUM)).toBe(true);
    expect(hasUnlimitedTripGenerations(TIERS.TRAVELER)).toBe(true);
  });

  it("exposes sit-in pricing labels", () => {
    expect(getTierLabel(TIERS.TRAVELER)).toBe("Traveler");
    expect(getTierPriceLabel(TIERS.PREMIUM)).toBe("$7.99/mo");
    expect(getTierPriceLabel(TIERS.TRAVELER)).toBe("$14.99/mo");
  });
});
