import { describe, expect, it } from "vitest";
import { dedupePlaces, normalizePlaceName, placeDedupKey } from "./placesDedup.js";

describe("placesDedup", () => {
  it("normalizes place names", () => {
    expect(normalizePlaceName("  Joe's   Cafe ")).toBe("joe's cafe");
  });

  it("dedupes by place id", () => {
    const places = [
      { placeId: "abc", name: "A" },
      { placeId: "abc", name: "A duplicate" },
      { placeId: "def", name: "B" },
    ];
    expect(dedupePlaces(places)).toHaveLength(2);
  });

  it("dedupes by geo key when id missing", () => {
    const key = placeDedupKey({ name: "Lookout", lat: 32.7767, lng: -96.797 });
    expect(key).toMatch(/^geo:/);
    const places = [
      { name: "Lookout", lat: 32.77671, lng: -96.79701 },
      { name: "Lookout", lat: 32.77672, lng: -96.79702 },
    ];
    expect(dedupePlaces(places)).toHaveLength(1);
  });
});
