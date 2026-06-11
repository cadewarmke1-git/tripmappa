import { describe, expect, it } from "vitest";
import { resolveHeroVariant } from "./resolveHeroVariant.js";
import { buildItineraryDays } from "./itineraryDays.js";
import { buildJourneyTimeline, countTimelineStopRows } from "./buildJourneyTimeline.js";

const FIXTURES = {
  truck: {
    answers: { vehicle: "Semi Truck (18-wheeler)", trip_type: "Work or Delivery run" },
    category: "commercial",
    stops: [{ city: "Amarillo, TX" }],
    roadStops: [
      { name: "Pilot", category: "fuel" },
      { name: "DOT Scale", category: "weigh" },
    ],
    origin: "Dallas, TX",
    dest: "Denver, CO",
    routeInfo: { distance: "780 mi", duration: "12 hr" },
  },
  multiDay: {
    answers: { vehicle: "Car" },
    category: "personal",
    stops: [{ city: "Amarillo, TX" }, { city: "Albuquerque, NM" }],
    roadStops: [{ name: "Scenic overlook", category: "scenic" }],
    origin: "Dallas, TX",
    dest: "Los Angeles, CA",
    routeInfo: { distance: "1400 mi", duration: "20 hr" },
  },
  overnight: {
    answers: { vehicle: "Car" },
    category: "personal",
    stops: [{ city: "Waco, TX", hotels: [{ name: "River Inn", price_band: "mid", rating: 4.2 }] }],
    roadStops: [{ name: "Lunch", category: "Food" }],
    origin: "Dallas, TX",
    dest: "Austin, TX",
    routeInfo: { distance: "195 mi", duration: "3 hr" },
  },
  scenicDay: {
    answers: { vehicle: "Car", trip_type: "Day trip", preferences: ["Scenic route"] },
    category: "personal",
    stops: [],
    roadStops: [{ name: "Bluebonnet Trail", category: "scenic", location: "Ennis, TX" }],
    origin: "Dallas, TX",
    dest: "Austin, TX",
    routeInfo: { distance: "195 mi", duration: "3 hr" },
  },
  day: {
    answers: { vehicle: "Car", trip_type: "Day trip" },
    category: "personal",
    stops: [],
    roadStops: [
      { name: "Coffee", category: "Food" },
      { name: "Park", category: "Rest" },
      { name: "Fuel", category: "fuel" },
    ],
    origin: "Dallas, TX",
    dest: "Austin, TX",
    routeInfo: { distance: "195 mi", duration: "3 hr" },
  },
};

describe("results layout fixtures", () => {
  for (const [name, fx] of Object.entries(FIXTURES)) {
    it(`resolves ${name} hero variant`, () => {
      expect(resolveHeroVariant(fx.answers, fx.category, fx.stops)).toBe(name);
    });
  }

  it("timeline exposes at least three visible stop rows for day fixture", () => {
    const fx = FIXTURES.day;
    const days = buildItineraryDays({
      origin: fx.origin,
      dest: fx.dest,
      stops: fx.stops,
      roadStops: fx.roadStops,
      routeInfo: fx.routeInfo,
      answers: fx.answers,
    });
    const rows = buildJourneyTimeline({ days, dest: fx.dest });
    expect(countTimelineStopRows(rows)).toBeGreaterThanOrEqual(3);
  });
});
