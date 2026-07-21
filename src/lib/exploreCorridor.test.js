import { describe, it, expect } from "vitest";
import {
  parseRouteDurationSeconds,
  computeExploreCorridor,
  stopsInExploreCorridor,
} from "./exploreCorridor.js";

describe("exploreCorridor", () => {
  const routePoints = [
    { lat: 30.0, lng: -97.0 },
    { lat: 30.1, lng: -97.0 },
    { lat: 30.2, lng: -97.0 },
    { lat: 30.3, lng: -97.0 },
    { lat: 30.4, lng: -97.0 },
  ];

  it("parses duration labels", () => {
    expect(parseRouteDurationSeconds("3 hours 30 mins")).toBe(12600);
    expect(parseRouteDurationSeconds("13 hr")).toBe(46800);
  });

  it("slices a reachable corridor along the route", () => {
    const corridor = computeExploreCorridor({
      routePoints,
      driveSeconds: 3600,
      totalDurationSeconds: 4 * 3600,
    });
    expect(corridor.path.length).toBeGreaterThan(1);
    expect(corridor.endIndex).toBeLessThan(routePoints.length);
    expect(corridor.endIndex).toBeGreaterThan(0);
  });

  it("filters stops inside the corridor", () => {
    const corridor = computeExploreCorridor({
      routePoints,
      driveSeconds: 3600,
      totalDurationSeconds: 4 * 3600,
    });
    const stops = [
      { id: "a", name: "Near start", lat: 30.05, lng: -97.0 },
      { id: "b", name: "Far end", lat: 30.39, lng: -97.0 },
    ];
    const inside = stopsInExploreCorridor(stops, corridor, routePoints);
    expect(inside.some((s) => s.id === "a")).toBe(true);
  });
});
