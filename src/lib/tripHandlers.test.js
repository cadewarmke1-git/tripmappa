import { describe, expect, it } from "vitest";
import { parseTripApiResponse } from "./tripHandlers.js";

const noopFallback = () => ({
  stops: [{ city: "Fallback City" }],
  roadStops: [],
  tripTips: ["fallback tip"],
  hosCompliance: null,
  truckSafety: null,
  rvSafety: null,
});

describe("parseTripApiResponse", () => {
  it("preserves truck and RV safety fields from the API", () => {
    const parsed = parseTripApiResponse(
      {
        stops: [{ city: "Amarillo, TX", name: "Amarillo" }],
        road_stops: [{ name: "Rest stop", city: "Amarillo, TX" }],
        tips: ["Drive safe"],
        hos_compliance: { compliant: true },
        safety: { truck: { lowBridges: [] }, rv: { steepGrades: [] } },
      },
      { vehicle: "Semi Truck (18-wheeler)" },
      {},
      noopFallback,
    );

    expect(parsed.usedFallback).toBe(false);
    expect(parsed.hosCompliance).toEqual({ compliant: true });
    expect(parsed.truckSafety).toEqual({ lowBridges: [] });
    expect(parsed.rvSafety).toEqual({ steepGrades: [] });
  });

  it("marks empty API payloads as fallback", () => {
    const parsed = parseTripApiResponse({}, { vehicle: "Car" }, {}, noopFallback);
    expect(parsed.usedFallback).toBe(true);
    expect(parsed.stops[0].city).toBe("Fallback City");
  });
});
