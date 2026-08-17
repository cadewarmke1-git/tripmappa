import { describe, expect, it } from "vitest";
import {
  isSameResolvedPlace,
  looksLikeLatLng,
  PLACES_ADDRESS_AUTOCOMPLETE_OPTIONS,
  toDirectionsWaypoint,
} from "./places.js";

describe("places address helpers", () => {
  it("restricts Autocomplete to a single geocode type (mixing types is INVALID_REQUEST)", () => {
    expect(PLACES_ADDRESS_AUTOCOMPLETE_OPTIONS.types).toEqual(["geocode"]);
    expect(PLACES_ADDRESS_AUTOCOMPLETE_OPTIONS.types).toHaveLength(1);
  });

  it("treats identical place IDs as the same place", () => {
    expect(isSameResolvedPlace(
      { placeId: "abc", formattedAddress: "Oklahoma City, OK, USA" },
      { placeId: "abc", formattedAddress: "Oklahoma City, Oklahoma, USA" },
      "Oklahoma City, OK",
      "Oklahoma City, OK",
    )).toBe(true);
  });

  it("does not treat different cities as the same place", () => {
    expect(isSameResolvedPlace(
      { placeId: "okc", formattedAddress: "Oklahoma City, OK, USA" },
      { placeId: "dal", formattedAddress: "Dallas, TX, USA" },
      "Oklahoma City, OK",
      "Dallas, TX",
    )).toBe(false);
  });

  it("detects lat,lng GPS strings so they skip Places lookup", () => {
    expect(looksLikeLatLng("35.4676, -97.5164")).toBe(true);
    expect(looksLikeLatLng("Oklahoma City, OK")).toBe(false);
  });

  it("builds a Directions placeId waypoint when resolved", () => {
    expect(toDirectionsWaypoint({ placeId: "ChIJokc" }, "Oklahoma City, OK")).toEqual({ placeId: "ChIJokc" });
    expect(toDirectionsWaypoint(null, "Oklahoma City, OK")).toBe("Oklahoma City, OK");
  });
});
