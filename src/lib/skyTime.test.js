import { describe, expect, it } from "vitest";
import {
  computeAutoTheme,
  formatSkyHour,
  getHeroSurfaceTheme,
  getHeroUiThemeFromHour,
  getSkyAtmosphere,
  getSkyPhase,
  getSkyPhaseFromHour,
  resolveSkyPhase,
  resolveThemeToggle,
  skyPhaseToUiTheme,
  SKY_PHASES,
} from "./skyTime.js";

describe("skyTime", () => {
  it("matches auto theme to sky cycle phases", () => {
    expect(computeAutoTheme(new Date("2026-05-23T12:00:00"))).toBe("day");
    expect(computeAutoTheme(new Date("2026-05-23T18:59:00"))).toBe("twilight");
    expect(computeAutoTheme(new Date("2026-05-23T22:00:00"))).toBe("night");
    expect(computeAutoTheme(new Date("2026-05-23T08:00:00"))).toBe("day");
    expect(computeAutoTheme(new Date("2026-05-23T06:30:00"))).toBe("twilight");
  });

  it("maps local hours to sky phases", () => {
    expect(getSkyPhase(new Date("2026-05-23T04:00:00"))).toBe(SKY_PHASES.pre_dawn);
    expect(getSkyPhase(new Date("2026-05-23T06:00:00"))).toBe(SKY_PHASES.sunrise);
    expect(getSkyPhase(new Date("2026-05-23T12:00:00"))).toBe(SKY_PHASES.midday);
    expect(getSkyPhase(new Date("2026-05-23T17:00:00"))).toBe(SKY_PHASES.golden_hour);
    expect(getSkyPhase(new Date("2026-05-23T19:30:00"))).toBe(SKY_PHASES.dusk);
    expect(getSkyPhase(new Date("2026-05-23T22:00:00"))).toBe(SKY_PHASES.night);
  });

  it("maps fractional hours to sky phases", () => {
    expect(getSkyPhaseFromHour(4)).toBe(SKY_PHASES.pre_dawn);
    expect(getSkyPhaseFromHour(6)).toBe(SKY_PHASES.sunrise);
    expect(getSkyPhaseFromHour(12.5)).toBe(SKY_PHASES.midday);
    expect(getSkyPhaseFromHour(17)).toBe(SKY_PHASES.golden_hour);
    expect(getSkyPhaseFromHour(20)).toBe(SKY_PHASES.dusk);
    expect(getSkyPhaseFromHour(22)).toBe(SKY_PHASES.night);
  });

  it("formats sky dial hours", () => {
    expect(formatSkyHour(14.5)).toBe("14:30");
    expect(formatSkyHour(0)).toBe("00:00");
  });

  it("derives hero UI theme from sky phase", () => {
    expect(skyPhaseToUiTheme(SKY_PHASES.midday)).toBe("day");
    expect(skyPhaseToUiTheme(SKY_PHASES.sunrise)).toBe("twilight");
    expect(skyPhaseToUiTheme(SKY_PHASES.night)).toBe("night");
  });

  it("maps fractional hours to surface theme with twilight buffer", () => {
    expect(getHeroUiThemeFromHour(12)).toBe("day");
    expect(getHeroUiThemeFromHour(6)).toBe("twilight");
    expect(getHeroUiThemeFromHour(18)).toBe("twilight");
    expect(getHeroUiThemeFromHour(22)).toBe("night");
    expect(getHeroSurfaceTheme(6)).toBe("night");
    expect(getHeroSurfaceTheme(12)).toBe("day");
  });

  it("interpolates sky atmosphere smoothly across the day", () => {
    const noon = getSkyAtmosphere(12);
    const night = getSkyAtmosphere(23);
    expect(noon.cssVars["--sky-stars"]).toBe("0");
    expect(parseFloat(night.cssVars["--sky-stars"])).toBeGreaterThan(0.8);
    expect(noon.cssVars["--photo-bright"]).toBeDefined();
    expect(parseFloat(night.cssVars["--photo-bright"])).toBeLessThan(0.5);
    expect(noon.cssVars["--sun-visible"]).toBeUndefined();
    expect(noon.cssVars["--moon-visible"]).toBeUndefined();
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
