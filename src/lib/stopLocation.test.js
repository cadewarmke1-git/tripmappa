import { describe, expect, it } from "vitest";
import { googleMapsUrl, stopAddressLabel } from "./stopLocation.js";

describe("stopLocation", () => {
  it("builds address from stop fields", () => {
    expect(stopAddressLabel({ title: "Joe's Diner", city: "Austin, TX" })).toBe("Joe's Diner");
    expect(stopAddressLabel({ location: "Rest Area 42", city: "Oklahoma City, OK" })).toBe("Rest Area 42");
  });

  it("builds Google Maps url from coordinates", () => {
    expect(googleMapsUrl({ lat: 32.7, lng: -96.8 })).toContain("32.7");
  });
});
