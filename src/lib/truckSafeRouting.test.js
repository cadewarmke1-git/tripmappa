import { describe, expect, it } from "vitest";

/**
 * truckSafe must mirror the real routing source, not vehicle type.
 * (Logic mirrored from useMapState / StartNavigationChooser.)
 */
function buildRouteFlags({ provider, vehicle }) {
  const isHere = provider === "here";
  return {
    routeProvider: provider,
    truckSafe: isHere,
    // Chooser must not treat Google+truck vehicle as HERE-safe.
    hasHereTruckRoute: provider === "here",
    vehicle,
  };
}

describe("truckSafe routing honesty", () => {
  it("is true only for HERE truck-aware routes", () => {
    const here = buildRouteFlags({ provider: "here", vehicle: "Semi" });
    expect(here.truckSafe).toBe(true);
    expect(here.hasHereTruckRoute).toBe(true);
    expect(here.routeProvider).toBe("here");
  });

  it("is false for Google Directions even when vehicle is a truck", () => {
    const google = buildRouteFlags({ provider: "google", vehicle: "Semi" });
    expect(google.truckSafe).toBe(false);
    expect(google.hasHereTruckRoute).toBe(false);
    expect(google.routeProvider).toBe("google");
  });

  it("does not treat a stale truckSafe flag as HERE-safe without routeProvider here", () => {
    const stale = { routeProvider: "google", truckSafe: true };
    const hasHereTruckRoute = stale.routeProvider === "here";
    expect(hasHereTruckRoute).toBe(false);
  });
});
