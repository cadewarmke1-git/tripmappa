import { describe, expect, it } from "vitest";
import { isGooglePlaceId, prefersPhotoFallback } from "./photoDisplayPolicy.js";

describe("photoDisplayPolicy", () => {
  it("prefers fallback for food/discovery; real photos for fuel family", () => {
    expect(prefersPhotoFallback("food", "google")).toBe(true);
    expect(prefersPhotoFallback("lodging", "google")).toBe(true);
    expect(prefersPhotoFallback("discovery", "google")).toBe(true);
    expect(prefersPhotoFallback("fuel", "google")).toBe(false);
    expect(prefersPhotoFallback("gas_station", "google")).toBe(false);
    expect(prefersPhotoFallback("truck_stop", "google")).toBe(false);
    expect(prefersPhotoFallback("food", "osm")).toBe(true);
  });

  it("detects Google place ids", () => {
    expect(isGooglePlaceId("ChIJabc")).toBe(true);
    expect(isGooglePlaceId("osm-123")).toBe(false);
    expect(isGooglePlaceId("")).toBe(false);
  });
});
