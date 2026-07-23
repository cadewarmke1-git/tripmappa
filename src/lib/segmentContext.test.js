import { describe, expect, it } from "vitest";
import {
  applyContextToPlaceList,
  buildSegmentContexts,
  classifyWeatherSeverity,
  formatSegmentContextBlock,
  formatSegmentContextLine,
  fuelPreferFill,
  isDaylightAt,
  isLikelyOpenAtArrival,
  isOutdoorCandidate,
} from "./segmentContext.js";

describe("segmentContext", () => {
  it("detects outdoor overlooks and parks", () => {
    expect(isOutdoorCandidate({ name: "Caprock Overlook", types: ["tourist_attraction"] })).toBe(true);
    expect(isOutdoorCandidate({ name: "City Diner", types: ["restaurant"] })).toBe(false);
    expect(isOutdoorCandidate({ name: "Playground", category: "playground" })).toBe(true);
  });

  it("flags extreme heat and precip", () => {
    const hot = classifyWeatherSeverity({ temperatureF: 104, precipitationChance: 10, severeWarnings: [] });
    expect(hot.flags).toContain("heat");
    expect(hot.extreme).toBe(true);
    const wet = classifyWeatherSeverity({ temperatureF: 70, precipitationChance: 80 });
    expect(wet.flags).toContain("precip");
  });

  it("deprioritizes outdoor candidates in extreme heat", () => {
    const ranked = applyContextToPlaceList(
      [
        { name: "Desert Overlook", types: ["park"], rating: 4.8 },
        { name: "Adobe Cafe", types: ["restaurant", "cafe"], rating: 4.2 },
      ],
      {
        weather: { temperatureF: 104, precipitationChance: 5, severeWarnings: [] },
        arrival: new Date("2026-07-22T12:00:00"),
        lat: 31.5,
        minKeep: 1,
      },
    );
    expect(ranked[0].name).toBe("Adobe Cafe");
    expect(ranked.find(p => p.name === "Desert Overlook")?.contextNotes).toContain("heat");
  });

  it("drops closed places when alternatives remain", () => {
    const arrival = new Date();
    const ranked = applyContextToPlaceList(
      [
        { name: "Closed Spot", openNow: false, rating: 4.9 },
        { name: "Open Spot", openNow: true, rating: 4.1 },
      ],
      { arrival, minKeep: 1 },
    );
    expect(ranked.map(p => p.name)).toEqual(["Open Spot"]);
  });

  it("keeps unknown-hours places (no over-filter)", () => {
    expect(isLikelyOpenAtArrival({ name: "Mystery" }, new Date())).toBe(true);
  });

  it("marks preferFill only when corridor spread is meaningful", () => {
    expect(fuelPreferFill(2.89, [2.89, 3.4]).preferFill).toBe(true);
    expect(fuelPreferFill(3.1, [3.05, 3.12]).preferFill).toBe(false);
  });

  it("formats a compact segment context line", () => {
    const line = formatSegmentContextLine({
      mileLabel: "~120mi",
      weatherClass: { tempF: 104, flags: ["heat"], advisory: "Excessive Heat Warning" },
      daylight: true,
      fuel: { regularPrice: "$2.89/gal", region: "gulf" },
      preferIndoor: true,
      preferFill: true,
    }, 2);
    expect(line).toMatch(/^SEG3/);
    expect(line).toContain("104F");
    expect(line).toContain("preferIndoor");
    expect(line).toContain("preferFill");
    expect(line.length).toBeLessThan(160);
  });

  it("builds segment contexts and a prompt block", () => {
    const contexts = buildSegmentContexts({
      corridor: [
        { lat: 32.8, lng: -96.8 },
        { lat: 30.3, lng: -97.7 },
      ],
      weatherByKey: {
        "seg-0": { temperatureF: 104, condition: "Hot", precipitationChance: 5, severeWarnings: [{ type: "Heat" }] },
      },
      fuelByKey: {
        "seg-0": { regular: 2.89, regularPrice: "$2.89/gal", region: "gulf" },
        "seg-1": { regular: 3.35, regularPrice: "$3.35/gal", region: "gulf" },
      },
      departure: new Date("2026-07-22T08:00:00"),
      totalHours: 4,
      totalMiles: 200,
    });
    expect(contexts[0].preferIndoor).toBe(true);
    expect(contexts[0].preferFill).toBe(true);
    expect(contexts[1].avoidFill).toBe(true);
    const block = formatSegmentContextBlock(contexts);
    expect(block).toContain("SEGMENT CONTEXT");
    expect(block).toContain("SEG1");
  });

  it("treats midday as daylight at mid latitudes", () => {
    expect(isDaylightAt(new Date("2026-07-22T13:00:00"), 32)).toBe(true);
    expect(isDaylightAt(new Date("2026-07-22T23:30:00"), 32)).toBe(false);
  });
});
