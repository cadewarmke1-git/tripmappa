import { describe, expect, it } from "vitest";
import { normalizeTripResponse } from "../../server/lib/tripResponseNormalize.js";

describe("normalizeTripResponse", () => {
  it("coerces route_summary object to string", () => {
    const out = normalizeTripResponse({
      trip_format: "multi_day",
      route_summary: { text: "Dallas to Asheville" },
      stops: [{ city: "Memphis, TN" }],
      road_stops: [],
    });
    expect(typeof out.route_summary).toBe("string");
    expect(out.route_summary).toContain("Dallas");
  });

  it("wraps tips string in array", () => {
    const out = normalizeTripResponse({
      trip_format: "simplified",
      tips: "One tip",
      road_stops: [{ location: "Austin, TX", name: "Stop" }],
    });
    expect(Array.isArray(out.tips)).toBe(true);
    expect(out.tips[0]).toBe("One tip");
  });
});
