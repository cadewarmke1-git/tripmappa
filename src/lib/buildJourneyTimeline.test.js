import { describe, expect, it } from "vitest";
import { buildItineraryDays } from "./itineraryDays.js";
import { buildJourneyTimeline, countTimelineStopRows } from "./buildJourneyTimeline.js";

describe("buildJourneyTimeline", () => {
  it("includes stops, drive dividers, overnight accent rows, and destination", () => {
    const days = buildItineraryDays({
      origin: "Dallas, TX",
      dest: "Austin, TX",
      stops: [{ city: "Waco, TX", why: "Rest up" }],
      roadStops: [{ name: "Rest stop", location: "Hillsboro, TX", category: "Rest", distance: "45 mi", eta: "40 min" }],
      routeInfo: { distance: "195 mi", duration: "3 hr" },
    });
    const rows = buildJourneyTimeline({ days, dest: "Austin, TX" });
    expect(rows.some(r => r.kind === "drive")).toBe(true);
    expect(rows.some(r => r.kind === "stop" && r.isOvernight)).toBe(true);
    expect(rows.some(r => r.kind === "destination")).toBe(true);
    expect(countTimelineStopRows(rows)).toBeGreaterThanOrEqual(3);
  });
});
