import { describe, expect, it } from "vitest";
import {
  computeAutoTheme,
  getSkyPhase,
  resolveSkyPhase,
  resolveThemeToggle,
  SKY_PHASES,
} from "./skyTime.js";

describe("skyTime", () => {
  it("defaults theme to day before 7 PM and night at/after 7 PM", () => {
    expect(computeAutoTheme(new Date("2026-05-23T18:59:00"))).toBe("day");
    expect(computeAutoTheme(new Date("2026-05-23T19:00:00"))).toBe("night");
  });

  it("maps local hours to sky phases", () => {
    expect(getSkyPhase(new Date("2026-05-23T04:00:00"))).toBe(SKY_PHASES.pre_dawn);
    expect(getSkyPhase(new Date("2026-05-23T06:00:00"))).toBe(SKY_PHASES.sunrise);
    expect(getSkyPhase(new Date("2026-05-23T12:00:00"))).toBe(SKY_PHASES.midday);
    expect(getSkyPhase(new Date("2026-05-23T17:00:00"))).toBe(SKY_PHASES.golden_hour);
    expect(getSkyPhase(new Date("2026-05-23T19:30:00"))).toBe(SKY_PHASES.dusk);
    expect(getSkyPhase(new Date("2026-05-23T22:00:00"))).toBe(SKY_PHASES.night);
  });

  it("clears theme override when toggled back to the auto default", () => {
    expect(resolveThemeToggle("day", "night")).toBe(null);
    expect(resolveThemeToggle("night", "day")).toBe(null);
    expect(resolveThemeToggle("night", "night")).toBe("day");
  });

  it("locks sky phase to theme when appearance is manually overridden", () => {
    const noon = new Date("2026-05-23T12:00:00");
    expect(resolveSkyPhase({ theme: "night", now: noon, themeLocked: true })).toBe(SKY_PHASES.night);
    expect(resolveSkyPhase({ theme: "day", now: noon, themeLocked: true })).toBe(SKY_PHASES.midday);
    expect(resolveSkyPhase({ theme: "day", now: noon, themeLocked: false })).toBe(SKY_PHASES.midday);
  });
});
