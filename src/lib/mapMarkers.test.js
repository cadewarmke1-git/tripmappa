import { describe, expect, it } from "vitest";
import { canShowStopPopup, waypointsToNumberedMarkers } from "./mapMarkers.js";

describe("canShowStopPopup", () => {
  it("allows categorized planned stops", () => {
    expect(canShowStopPopup({
      id: "road-1",
      category: "restaurant",
      title: "Lunch stop",
    })).toBe(true);
  });

  it.each([
    { id: "destination", category: "destination", title: "Dallas, TX" },
    { id: "origin-0", category: "poi", role: "origin" },
    { id: "home_marker", category: "poi", markerType: "home" },
    { id: "destination-1", category: "hotel", isDestination: true },
  ])("blocks route endpoint marker %#", (marker) => {
    expect(canShowStopPopup(marker)).toBe(false);
  });

  it("blocks markers without a stop category", () => {
    expect(canShowStopPopup({ id: "uncategorized", title: "Dallas, TX" })).toBe(false);
  });

  it("blocks destination markers built from itinerary waypoints", () => {
    const [marker] = waypointsToNumberedMarkers([{
      id: "destination",
      kind: "destination",
      lat: 32.7767,
      lng: -96.797,
      title: "Dallas, TX",
    }]);

    expect(canShowStopPopup(marker)).toBe(false);
  });
});
