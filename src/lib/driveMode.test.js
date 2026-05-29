import { describe, expect, it } from "vitest";
import {
  buildContinuousDriveTip,
  isContinuousDrive,
  OVERNIGHT_PREFERENCE_CONTINUOUS,
  OVERNIGHT_PREFERENCE_OVERNIGHT,
  requiresMultipleDays,
} from "./driveMode.js";

describe("driveMode", () => {
  it("detects continuous drive from flag or preference", () => {
    expect(isContinuousDrive({ continuous_drive: true })).toBe(true);
    expect(isContinuousDrive({ overnight_preference: OVERNIGHT_PREFERENCE_CONTINUOUS })).toBe(true);
    expect(isContinuousDrive({ overnight_preference: OVERNIGHT_PREFERENCE_OVERNIGHT })).toBe(false);
    expect(isContinuousDrive(null)).toBe(false);
  });

  it("requires multiple days from distance and duration", () => {
    expect(requiresMultipleDays({ routeDistanceMiles: 100 })).toBe(false);
    expect(requiresMultipleDays({ routeDistanceMiles: 400, routeDurationHours: 7 })).toBe(true);
    expect(requiresMultipleDays({ routeDistanceMiles: 400, routeDurationHours: 5 })).toBe(false);
    expect(requiresMultipleDays({ routeDistanceMiles: 400 })).toBe(true);
    expect(requiresMultipleDays({ routeDistance: "500 mi", routeDuration: "12 hours" })).toBe(true);
  });

  it("builds continuous drive tip with route duration", () => {
    expect(buildContinuousDriveTip({ duration: "14 hours 20 mins" })).toMatch(/14 hours 20 mins/);
    expect(buildContinuousDriveTip({})).toMatch(/Continuous drive mode/);
  });
});
