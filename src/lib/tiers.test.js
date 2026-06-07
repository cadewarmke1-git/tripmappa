import { describe, expect, it } from "vitest";
import {
  TIERS,
  canUseGroceryDelivery,
  getAvatarTierBadge,
  getTierAnnualMonthlyEquivalent,
  getTierLabel,
  getTierPriceLabel,
  hasUnlimitedTripGenerations,
  isAtLeastTier,
  isFounderTier,
  normalizeTier,
} from "./tiers.js";

describe("tiers", () => {
  it("ranks tiers correctly", () => {
    expect(isAtLeastTier(TIERS.WANDERER, TIERS.VOYAGER)).toBe(false);
    expect(isAtLeastTier(TIERS.VOYAGER, TIERS.VOYAGER)).toBe(true);
    expect(isAtLeastTier(TIERS.TRAILBLAZER, TIERS.VOYAGER)).toBe(true);
    expect(isAtLeastTier(TIERS.VOYAGER, TIERS.TRAILBLAZER)).toBe(false);
    expect(isAtLeastTier(TIERS.FOUNDER, TIERS.TRAILBLAZER)).toBe(true);
  });

  it("maps legacy tier slugs", () => {
    expect(normalizeTier("free")).toBe(TIERS.WANDERER);
    expect(normalizeTier("premium")).toBe(TIERS.TRAILBLAZER);
    expect(normalizeTier("traveler")).toBe(TIERS.VOYAGER);
  });

  it("gates grocery to Trailblazer and Founder", () => {
    expect(canUseGroceryDelivery(TIERS.WANDERER)).toBe(false);
    expect(canUseGroceryDelivery(TIERS.VOYAGER)).toBe(false);
    expect(canUseGroceryDelivery(TIERS.TRAILBLAZER)).toBe(true);
    expect(canUseGroceryDelivery(TIERS.FOUNDER)).toBe(true);
  });

  it("gives unlimited generations to Voyager and above", () => {
    expect(hasUnlimitedTripGenerations(TIERS.WANDERER)).toBe(false);
    expect(hasUnlimitedTripGenerations(TIERS.VOYAGER)).toBe(true);
    expect(hasUnlimitedTripGenerations(TIERS.TRAILBLAZER)).toBe(true);
    expect(hasUnlimitedTripGenerations(TIERS.FOUNDER)).toBe(true);
  });

  it("exposes renamed pricing labels", () => {
    expect(getTierLabel(TIERS.VOYAGER)).toBe("Voyager");
    expect(getTierPriceLabel(TIERS.VOYAGER)).toBe("$4.99/mo");
    expect(getTierPriceLabel(TIERS.TRAILBLAZER)).toBe("$9.99/mo");
    expect(getTierPriceLabel(TIERS.VOYAGER, "year")).toBe("$39.99/yr");
    expect(getTierAnnualMonthlyEquivalent(TIERS.TRAILBLAZER)).toBe("6.67");
    expect(getTierLabel(TIERS.FOUNDER)).toBe("Founder");
  });

  it("returns avatar tier badges for paid tiers", () => {
    expect(getAvatarTierBadge(TIERS.WANDERER)).toBeNull();
    expect(getAvatarTierBadge(TIERS.VOYAGER)).toBe("voyager");
    expect(getAvatarTierBadge(TIERS.TRAILBLAZER)).toBe("trailblazer");
    expect(getAvatarTierBadge(TIERS.FOUNDER)).toBe("founder");
    expect(isFounderTier(TIERS.FOUNDER)).toBe(true);
  });
});
