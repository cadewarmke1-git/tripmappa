import { describe, it, expect } from "vitest";
import { hereActionToManeuver, parseHereRouteSteps } from "./hereNavigationSteps.js";
import { resolveNavigationSteps } from "./navigationSteps.js";
import { detectNavApps, buildExternalNavUrl } from "./externalNavApps.js";

describe("hereActionToManeuver", () => {
  it("maps turn left/right", () => {
    expect(hereActionToManeuver({ action: "turn", direction: "left" })).toBe("left");
    expect(hereActionToManeuver({ action: "turn", direction: "right" })).toBe("right");
  });

  it("maps keep and roundabout", () => {
    expect(hereActionToManeuver({ action: "keep", direction: "left" })).toBe("slight-left");
    expect(hereActionToManeuver({ action: "roundaboutEnter" })).toBe("roundabout");
  });
});

describe("parseHereRouteSteps", () => {
  it("builds cockpit steps from multi-section HERE actions", () => {
    // Minimal synthetic polyline: encode is complex — use actions with length and mock via
    // injecting a hereRoute whose sections already include decoded-friendly empty polyline
    // and rely on instruction/maneuver mapping when polyline decode yields [].
    const hereRoute = {
      routes: [{
        sections: [
          {
            polyline: null,
            actions: [
              {
                action: "depart",
                instruction: "Head south on I-35.",
                offset: 0,
                length: 1200,
                duration: 60,
              },
              {
                action: "turn",
                direction: "right",
                instruction: "Turn right onto US-79.",
                offset: 10,
                length: 800,
                duration: 40,
              },
              {
                action: "arrive",
                instruction: "Arrive at stop.",
                offset: 20,
                length: 0,
                duration: 0,
              },
            ],
          },
          {
            polyline: null,
            actions: [
              {
                action: "depart",
                instruction: "Continue toward Austin.",
                offset: 0,
                length: 5000,
                duration: 300,
              },
              {
                action: "arrive",
                instruction: "Arrive at destination.",
                offset: 40,
                length: 0,
                duration: 0,
              },
            ],
          },
        ],
      }],
    };

    const steps = parseHereRouteSteps(hereRoute);
    expect(steps.length).toBe(5);
    expect(steps[1].instruction).toMatch(/Turn right/i);
    expect(steps[1].maneuver).toBe("right");
    expect(steps[1].source).toBe("here");
    expect(steps.some((s) => /Arrive at destination/i.test(s.instruction))).toBe(true);
  });

  it("prefers HERE steps over polyline fallback in resolveNavigationSteps", () => {
    const hereRoute = {
      routes: [{
        sections: [{
          actions: [
            { action: "turn", direction: "left", instruction: "Turn left onto Main St.", offset: 0, length: 100, duration: 20 },
            { action: "arrive", instruction: "Arrive.", offset: 5, length: 0, duration: 0 },
          ],
        }],
      }],
    };
    const steps = resolveNavigationSteps({
      directionsResult: null,
      hereRoute,
      routePoints: [
        { lat: 32, lng: -97 },
        { lat: 31, lng: -97 },
        { lat: 30, lng: -97 },
      ],
    });
    expect(steps[0].instruction).toMatch(/Turn left/i);
    expect(steps.every((s) => s.instruction !== "Continue on route" || s.source === "here")).toBe(true);
  });
});

describe("externalNavApps", () => {
  it("hides Apple Maps on Android UA", () => {
    const apps = detectNavApps("Mozilla/5.0 (Linux; Android 13)");
    expect(apps.appleMaps).toBe(false);
    expect(apps.googleMaps).toBe(true);
  });

  it("shows Apple Maps on iPhone UA", () => {
    const apps = detectNavApps("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    expect(apps.appleMaps).toBe(true);
  });

  it("builds destination coordinate deep links", () => {
    const coords = { lat: 30.2672, lng: -97.7431 };
    expect(buildExternalNavUrl("google", coords)).toContain("destination=30.2672,-97.7431");
    expect(buildExternalNavUrl("apple", coords)).toContain("daddr=30.2672,-97.7431");
    expect(buildExternalNavUrl("waze", coords)).toContain("ll=30.2672");
  });
});
