import { describe, expect, it } from "vitest";
import { buildRouteBoundary } from "./placesContext.js";

describe("buildRouteBoundary corridor cap", () => {
  it("caps samples at 12 for routes over 600 miles", () => {
    const routePoints = Array.from({ length: 1600 }, (_, i) => ({
      lat: 32 + i * 0.01,
      lng: -96 + i * 0.005,
    }));
    const boundary = buildRouteBoundary({ distance: "1,548 mi", routePoints });
    expect(boundary.samples.length).toBeLessThanOrEqual(12);
    expect(boundary.samples.length).toBeGreaterThan(8);
  });

  it("uses ~50 mi spacing for routes under 600 miles", () => {
    const routePoints = Array.from({ length: 700 }, (_, i) => ({
      lat: 32 + i * 0.01,
      lng: -96 + i * 0.005,
    }));
    const boundary = buildRouteBoundary({ distance: "664 mi", routePoints });
    expect(boundary.samples.length).toBeLessThanOrEqual(12);
    expect(boundary.intervalMiles).toBeGreaterThanOrEqual(50);
  });

  it("uses 50 mi sample interval on typical routes", () => {
    const routePoints = Array.from({ length: 240 }, (_, i) => ({
      lat: 32 + i * 0.04,
      lng: -96 - i * 0.02,
    }));
    const boundary = buildRouteBoundary({ distance: "239 mi", routePoints });
    expect(boundary.intervalMiles).toBe(50);
    expect(boundary.samples.length).toBeGreaterThan(0);
  });
});
