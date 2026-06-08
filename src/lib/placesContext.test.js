import { describe, expect, it } from "vitest";
import { buildRouteBoundary } from "./placesContext.js";

describe("buildRouteBoundary corridor cap", () => {
  it("caps samples at 30 for routes over 800 miles", () => {
    const routePoints = Array.from({ length: 1600 }, (_, i) => ({
      lat: 32 + i * 0.01,
      lng: -96 + i * 0.005,
    }));
    const boundary = buildRouteBoundary({ distance: "1,548 mi", routePoints });
    expect(boundary.samples.length).toBeLessThanOrEqual(30);
    expect(boundary.samples.length).toBeGreaterThan(10);
  });

  it("keeps normal density for routes under 800 miles", () => {
    const routePoints = Array.from({ length: 700 }, (_, i) => ({
      lat: 32 + i * 0.01,
      lng: -96 + i * 0.005,
    }));
    const boundary = buildRouteBoundary({ distance: "664 mi", routePoints });
    expect(boundary.samples.length).toBeGreaterThan(15);
    expect(boundary.samples.length).toBeLessThanOrEqual(30);
  });
});
