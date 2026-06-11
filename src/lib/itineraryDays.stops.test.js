import { describe, expect, it } from "vitest";
import { countTimelineStops, getItineraryOverview } from "./itineraryDays.js";

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
});
