import { describe, expect, it } from "vitest";
import { sliceRouteLegPath, buildAnchorPointsFromWaypoints } from "./routeLegPaths.js";

describe("routeLegPaths", () => {
  it("builds anchor chain from waypoints", () => {
    const anchors = buildAnchorPointsFromWaypoints([
      { kind: "origin", lat: 32, lng: -96, included: true },
      { kind: "stop", id: "a", lat: 31, lng: -97, included: true },
      { kind: "destination", lat: 30, lng: -98, included: true },
    ]);
    expect(anchors).toHaveLength(3);
  });

  it("slices a leg path between anchors", () => {
    const routePoints = [
      { lat: 32, lng: -96 },
      { lat: 31.5, lng: -96.5 },
      { lat: 31, lng: -97 },
      { lat: 30.5, lng: -97.5 },
      { lat: 30, lng: -98 },
    ];
    const anchors = [
      { lat: 32, lng: -96 },
      { lat: 31, lng: -97 },
      { lat: 30, lng: -98 },
    ];
    const slice = sliceRouteLegPath(routePoints, anchors, 0);
    expect(slice.length).toBeGreaterThan(1);
  });
});
