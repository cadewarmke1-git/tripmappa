import { describe, expect, it } from "vitest";
import { countTimelineStops, getItineraryOverview, isIncludedRoadStop } from "./itineraryDays.js";
import { buildInitialItineraryWaypoints, countIncludedStops } from "./itineraryWaypoints.js";

describe("countTimelineStops", () => {
  it("counts road stops plus overnight cities", () => {
    const count = countTimelineStops({
      stops: [{ city: "Austin, TX" }, { city: "Dallas, TX" }],
      roadStops: [
        { name: "Fuel stop", location: "Waco, TX" },
        { name: "Lunch", location: "Temple, TX" },
      ],
    });
    expect(count).toBe(4);
  });

  it("excludes enrichment suggestions and removed stops", () => {
    const count = countTimelineStops({
      stops: [],
      roadStops: [
        { name: "Planned lunch", location: "Waco, TX" },
        { name: "Love's", location: "Ardmore, OK", userAdded: false },
        { name: "Removed fuel", location: "Gainesville, TX", userAdded: false },
      ],
    });
    expect(count).toBe(1);
  });

  it("matches hero overview stop count", () => {
    const overview = getItineraryOverview({
      origin: "Dallas, TX",
      dest: "Austin, TX",
      routeInfo: { distance: "195 mi", duration: "3 hr" },
      stops: [{ city: "Austin, TX" }],
      roadStops: [{ name: "Rest", location: "Waco, TX" }, { name: "Fuel", location: "Hillsboro, TX" }],
    });
    expect(overview.stopCount).toBe(3);
  });

  it("uses included waypoints when provided", () => {
    const waypoints = buildInitialItineraryWaypoints({
      origin: "Dallas, TX",
      dest: "Oklahoma City, OK",
      routeInfo: { distance: "206 mi", duration: "3 hr" },
      stops: [],
      roadStops: [
        { name: "Gainesville lunch", location: "Gainesville, TX" },
        { name: "Pauls Valley lunch", location: "Pauls Valley, OK" },
        { name: "Love's", location: "Ardmore, OK", userAdded: false },
      ],
      answers: { trip_type: "Road trip", lodging: "No overnight stay" },
    });
    const overview = getItineraryOverview({
      origin: "Dallas, TX",
      dest: "Oklahoma City, OK",
      routeInfo: { distance: "206 mi", duration: "3 hr" },
      stops: [],
      roadStops: [
        { name: "Gainesville lunch", location: "Gainesville, TX" },
        { name: "Pauls Valley lunch", location: "Pauls Valley, OK" },
        { name: "Love's", location: "Ardmore, OK", userAdded: false },
      ],
      waypoints,
    });
    expect(overview.stopCount).toBe(countIncludedStops(waypoints));
    expect(overview.stopCount).toBe(2);
  });

  it("hides day count for straight-through trips", () => {
    const overview = getItineraryOverview({
      origin: "Dallas, TX",
      dest: "Houston, TX",
      routeInfo: { distance: "240 mi", duration: "4 hr" },
      stops: [],
      roadStops: [{ name: "Fuel", location: "Madisonville, TX" }],
      answers: { overnight_preference: "Drive straight through", continuous_drive: true },
    });
    expect(overview.dayCount).toBeNull();
    expect(overview.straightThrough).toBe(true);
    expect(overview.stopCount).toBe(1);
  });
});

describe("isIncludedRoadStop", () => {
  it("treats undefined userAdded as included (LLM plan stops)", () => {
    expect(isIncludedRoadStop({ name: "Rest" })).toBe(true);
  });

  it("excludes explicit userAdded false", () => {
    expect(isIncludedRoadStop({ name: "Love's", userAdded: false })).toBe(false);
  });
});
