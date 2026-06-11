import { describe, expect, it } from "vitest";
import {
  buildTripSegments,
  stitchTripSegments,
  shouldUseParallelTripSegments,
  parseTripNights,
  dedupeConsecutiveStops,
} from "./planTripSegments.js";
import { normalizeTripResponse } from "./tripResponseNormalize.js";

describe("planTripSegments", () => {
  const routeInfo = {
    origin: "Dallas, TX",
    destination: "Los Angeles, CA",
    citiesAlongRoute: ["Dallas, TX", "Amarillo, TX", "Albuquerque, NM", "Flagstaff, AZ", "Los Angeles, CA"],
  };

  it("parseTripNights extracts count", () => {
    expect(parseTripNights("2 nights")).toBe(2);
    expect(parseTripNights("3 nights")).toBe(3);
  });

  it("shouldUseParallelTripSegments requires 1+ nights and corridor cities", () => {
    expect(shouldUseParallelTripSegments({
      answers: { trip_nights: "2 nights" },
      routeInfo,
      isSimplifiedFormat: false,
      continuousDrive: false,
    })).toBe(true);
    expect(shouldUseParallelTripSegments({
      answers: { trip_nights: "1 night" },
      routeInfo,
      isSimplifiedFormat: false,
      continuousDrive: false,
    })).toBe(true);
    expect(shouldUseParallelTripSegments({
      answers: { trip_nights: "2 nights" },
      routeInfo,
      isSimplifiedFormat: true,
      continuousDrive: false,
    })).toBe(false);
  });

  it("buildTripSegments returns 2 legs for a 1-night trip", () => {
    const segments = buildTripSegments(routeInfo, { trip_nights: "1 night" }, "Dallas, TX", "Los Angeles, CA");
    expect(segments).toHaveLength(2);
    expect(segments[0].isFirstSegment).toBe(true);
    expect(segments[1].isLastSegment).toBe(true);
    expect(segments[0].origin).toBe("Dallas, TX");
    expect(segments[1].destination).toBe("Los Angeles, CA");
  });

  it("buildTripSegments returns 2 legs for a 2-night trip", () => {
    const segments = buildTripSegments(routeInfo, { trip_nights: "2 nights" }, "Dallas, TX", "Los Angeles, CA");
    expect(segments).toHaveLength(2);
    expect(segments[0].isFirstSegment).toBe(true);
    expect(segments[1].isLastSegment).toBe(true);
    expect(segments[0].overnightCount).toBe(1);
    expect(segments[1].destination).toBe("Los Angeles, CA");
  });

  it("caps parallel segments at 4", () => {
    const segments = buildTripSegments(routeInfo, { trip_nights: "6 nights" }, "Dallas, TX", "Los Angeles, CA");
    expect(segments).toHaveLength(4);
  });

  it("dedupeConsecutiveStops removes parallel-segment overnight duplicates", () => {
    const deduped = dedupeConsecutiveStops([
      { city: "Amarillo, TX", lat: 35.2, lng: -101.8 },
      { city: "Amarillo, TX", lat: 35.201, lng: -101.801 },
    ]);
    expect(deduped).toHaveLength(1);
  });

  it("stitchTripSegments merges stops and dedupes tips", () => {
    const stitched = stitchTripSegments([
      {
        trip_format: "multi_day",
        route_summary: "Leg one summary",
        stops: [{ city: "Amarillo, TX", type: "overnight" }],
        road_stops: [{ name: "Fuel A", distance: "120 mi" }],
        tips: ["Tip A", "Shared tip"],
      },
      {
        trip_format: "multi_day",
        route_summary: "Leg two summary",
        stops: [{ city: "Los Angeles, CA", type: "overnight" }],
        road_stops: [{ name: "Fuel B", distance: "420 mi" }],
        tips: ["Tip B", "Shared tip"],
      },
    ]);
    expect(stitched.stops).toHaveLength(2);
    expect(stitched.road_stops).toHaveLength(2);
    expect(stitched.tips).toEqual(["Tip A", "Shared tip", "Tip B"]);
    expect(stitched.route_summary).toBe("Leg one summary");
    expect(() => normalizeTripResponse(stitched)).not.toThrow();
  });
});
