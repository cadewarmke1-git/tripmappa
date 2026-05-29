import { describe, expect, it } from "vitest";
import {
  dedupePlaces,
  dedupeRoadStops,
  normalizePlaceName,
  placeDedupKey,
  placeGoogleId,
} from "./placesDedup.js";

describe("placesDedup", () => {
  it("normalizes place names", () => {
    expect(normalizePlaceName("  Joe's   Cafe ")).toBe("joe's cafe");
  });

  it("reads Google place_id from multiple field names", () => {
    expect(placeGoogleId({ place_id: "ChIJabc" })).toBe("ChIJabc");
    expect(placeGoogleId({ placeId: "ChIJdef" })).toBe("ChIJdef");
  });

  it("dedupes by place_id first", () => {
    const places = [
      { place_id: "ChIJsame", name: "Pilot Travel Center" },
      { placeId: "ChIJsame", name: "Pilot — duplicate" },
      { place_id: "ChIJother", name: "Love's" },
    ];
    expect(dedupePlaces(places)).toHaveLength(2);
    expect(dedupeRoadStops(places)).toHaveLength(2);
  });

  it("dedupes by name and coordinates when place_id is missing", () => {
    const key = placeDedupKey({ name: "Lookout", lat: 32.7767, lng: -96.797 });
    expect(key).toMatch(/^geo:/);
    const places = [
      { name: "Lookout", lat: 32.77671, lng: -96.79701 },
      { name: "Lookout", lat: 32.77672, lng: -96.79702 },
      { name: "Other Stop", lat: 33.1, lng: -97.2 },
    ];
    expect(dedupePlaces(places)).toHaveLength(2);
  });
});
