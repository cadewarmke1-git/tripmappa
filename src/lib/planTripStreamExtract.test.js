import { describe, expect, it } from "vitest";
import { extractStreamStopProgress } from "./planTripStreamExtract.js";

describe("extractStreamStopProgress", () => {
  it("counts only stops and road_stops array entries, not nested hotel names", () => {
    const text = JSON.stringify({
      route_summary: "Dallas to Nashville",
      stops: [{
        city: "Little Rock, AR",
        hotels: [{ name: "Holiday Inn Little Rock" }],
        restaurants: [{ name: "Local Bistro" }],
      }],
      road_stops: [{ name: "Buc-ee's", location: "Temple, TX" }],
    });
    const extracted = extractStreamStopProgress(text);
    expect(extracted.cityNames).toEqual(["Little Rock, AR"]);
    expect(extracted.stopNames).toEqual(["Buc-ee's"]);
    expect(extracted.stopCount).toBe(2);
  });

  it("dedupes repeated road stop names during streaming", () => {
    const text = '{"road_stops":[{"name":"Pilot","location":"A"},{"name":"Pilot","location":"B"}]}';
    const extracted = extractStreamStopProgress(text);
    expect(extracted.stopNames).toEqual(["Pilot"]);
    expect(extracted.stopCount).toBe(1);
  });
});
