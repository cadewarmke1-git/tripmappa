import { describe, expect, it } from "vitest";
import {
  buildInitialItineraryWaypoints,
  reorderItineraryWaypoints,
  setWaypointIncluded,
  getSortableStopIds,
} from "./itineraryWaypoints.js";

describe("itineraryWaypoints", () => {
  const base = {
    origin: "Dallas, TX",
    dest: "Austin, TX",
    routeInfo: {
      distance: "195 mi",
      duration: "3 hr",
      originLat: 32.78,
      originLng: -96.8,
      destLat: 30.27,
      destLng: -97.74,
    },
    stops: [{ city: "Waco, TX", lat: 31.5, lng: -97.1 }],
    roadStops: [
      { id: "r1", name: "Rest stop", location: "Hillsboro, TX", lat: 32.0, lng: -97.1, category: "Rest" },
    ],
    answers: { vehicle: "Car" },
  };

  it("builds origin, included stops, and destination", () => {
    const wps = buildInitialItineraryWaypoints(base);
    expect(wps[0].kind).toBe("origin");
    expect(wps[wps.length - 1].kind).toBe("destination");
    expect(wps.some(w => w.kind === "stop" && w.included)).toBe(true);
  });

  it("reorders middle stops only", () => {
    const wps = buildInitialItineraryWaypoints({
      ...base,
      stops: [{ city: "Waco, TX", lat: 31.5, lng: -97.1 }, { city: "Temple, TX", lat: 31.1, lng: -97.3 }],
      roadStops: [],
    });
    const ids = getSortableStopIds(wps);
    if (ids.length < 2) return;
    const reordered = reorderItineraryWaypoints(wps, ids[1], ids[0]);
    expect(reordered[0].kind).toBe("origin");
    expect(reordered[reordered.length - 1].kind).toBe("destination");
    const middle = reordered.filter(w => w.kind === "stop" && w.included);
    expect(middle[0].id).toBe(ids[1]);
  });

  it("toggles included flag on stops", () => {
    const wps = buildInitialItineraryWaypoints(base);
    const stop = wps.find(w => w.kind === "stop");
    const next = setWaypointIncluded(wps, stop.id, false);
    expect(next.find(w => w.id === stop.id).included).toBe(false);
  });
});
