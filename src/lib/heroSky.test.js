import { describe, expect, it } from "vitest";
import {
  SKY_LIVE_TICK_MS,
  getLiveSkyHour,
  isSkyTestEnabled,
  parseSkyHourParam,
  resolveHeroSkyHour,
} from "./heroSky.js";

describe("heroSky", () => {
  it("parses skyHour URL param", () => {
    expect(parseSkyHourParam("?skyHour=12.5")).toBe(12.5);
    expect(parseSkyHourParam("?skyHour=99")).toBe(24);
    expect(parseSkyHourParam("?skyHour=bad")).toBeNull();
    expect(parseSkyHourParam("")).toBeNull();
  });

  it("shows sky test dial until removed before launch", () => {
    expect(isSkyTestEnabled()).toBe(true);
  });

  it("resolves hero hour with URL > dial > live priority", () => {
    expect(resolveHeroSkyHour({ liveHour: 10, dialOverride: 14, urlHour: null })).toBe(14);
    expect(resolveHeroSkyHour({ liveHour: 10, dialOverride: null, urlHour: 6 })).toBe(6);
    expect(resolveHeroSkyHour({ liveHour: 10, dialOverride: null, urlHour: null })).toBe(10);
  });

  it("computes fractional live hour", () => {
    const noon = new Date("2026-05-23T12:30:00");
    expect(getLiveSkyHour(noon)).toBeCloseTo(12.5, 5);
  });

  it("ticks live sky every second for smooth drift", () => {
    expect(SKY_LIVE_TICK_MS).toBe(1_000);
  });
});
