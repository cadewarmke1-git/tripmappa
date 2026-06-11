import { describe, expect, it } from "vitest";
import {
  formatHosSummaryLine,
  countFuelAndWeighStops,
  collectRouteHighlights,
  buildMultiDayChips,
  dayTripHeroStats,
} from "./heroVariantContent.js";
import { buildItineraryDays } from "./itineraryDays.js";

describe("heroVariantContent", () => {
  it("formats a single-line HOS summary", () => {
    const line = formatHosSummaryLine({ drivingDays: 2, overnightStopsRequired: 1 }, { duration: "14 hr" });
    expect(line).toMatch(/2 driving days/);
    expect(line).toMatch(/1 overnight stop/);
  });

  it("counts fuel and weigh stops", () => {
    const counts = countFuelAndWeighStops([
      { name: "Pilot Flying J", category: "fuel" },
      { name: "DOT Weigh Station", category: "weigh" },
      { name: "Love's", category: "fuel" },
    ]);
    expect(counts).toEqual({ fuel: 2, weigh: 1, total: 3 });
  });

  it("collects scenic route highlights", () => {
    const highlights = collectRouteHighlights({
      roadStops: [{ name: "Caprock Canyon", category: "scenic" }],
      recommendations: [{ name: "Palo Duro" }],
    });
    expect(highlights).toContain("Caprock Canyon");
    expect(highlights).toContain("Palo Duro");
  });

  it("builds multi-day chips through arrival day", () => {
    const days = buildItineraryDays({
      origin: "Dallas, TX",
      dest: "Los Angeles, CA",
      stops: [{ city: "Amarillo, TX" }, { city: "Albuquerque, NM" }],
      roadStops: [],
      routeInfo: { distance: "1200 mi", duration: "18 hr" },
    });
    const chips = buildMultiDayChips(days, "Los Angeles, CA");
    expect(chips).toHaveLength(2);
    expect(chips[0].label).toBe("Day 1");
    expect(chips[1].sub).toMatch(/Arrive Los Angeles/);
  });

  it("leads day hero with stops, drive time, and first highlight", () => {
    const days = buildItineraryDays({
      origin: "Dallas, TX",
      dest: "Austin, TX",
      stops: [],
      roadStops: [{ name: "Waco Suspension Bridge", category: "scenic", location: "Waco, TX" }],
      routeInfo: { distance: "195 mi", duration: "3 hr" },
    });
    const stats = dayTripHeroStats({
      routeInfo: { duration: "3 hr" },
      stops: [],
      roadStops: [{ name: "Waco Suspension Bridge", category: "scenic" }],
      days,
      recommendations: [],
    });
    expect(stats.stopCount).toBe(1);
    expect(stats.duration).toBe("3 hr");
    expect(stats.firstHighlight).toBe("Waco Suspension Bridge");
  });
});
