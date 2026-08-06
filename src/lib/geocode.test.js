import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { buildBusinessGeocodeQuery, geocodeAddress } from "../../server/lib/geocode.js";

describe("buildBusinessGeocodeQuery", () => {
  it("disambiguates Cadillac Ranch brewery from the art installation", () => {
    expect(buildBusinessGeocodeQuery("Cadillac Ranch Brewing Company", "Amarillo, TX"))
      .toBe("Cadillac Ranch Brewing Company brewery restaurant, Amarillo, TX");
  });

  it("leaves unrelated brewery names unchanged aside from city", () => {
    expect(buildBusinessGeocodeQuery("Other Side Brewery", "Austin, TX"))
      .toBe("Other Side Brewery, Austin, TX");
  });

  it("leaves plain city queries alone", () => {
    expect(buildBusinessGeocodeQuery("Amarillo, TX", "")).toBe("Amarillo, TX");
  });
});

describe("geocodeAddress brewery disambiguation", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.GOOGLE_MAPS_API_KEY;
  });

  it("prefers Find Place brewery over tourist-attraction geocode", async () => {
    global.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes("findplacefromtext")) {
        return {
          json: async () => ({
            status: "OK",
            candidates: [{
              place_id: "brewery-id",
              name: "Cadillac Ranch Brewing Company",
              formatted_address: "500 S Taylor St, Amarillo, TX 79101, USA",
              geometry: { location: { lat: 35.2065, lng: -101.833 } },
              types: ["brewery", "bar", "restaurant", "food", "establishment"],
            }],
          }),
        };
      }
      return {
        json: async () => ({
          status: "OK",
          results: [{
            place_id: "art-id",
            formatted_address: "13651 I-40 Frontage Rd, Amarillo, TX 79124, USA",
            geometry: { location: { lat: 35.1872366, lng: -101.9870486 } },
            types: ["tourist_attraction", "point_of_interest"],
          }],
        }),
      };
    });

    const result = await geocodeAddress("Cadillac Ranch Brewing Company, Amarillo, TX");
    expect(result).toMatchObject({
      lat: 35.2065,
      lng: -101.833,
      formatted: "500 S Taylor St, Amarillo, TX 79101, USA",
    });
    expect(String(global.fetch.mock.calls[0][0])).toContain("findplacefromtext");
  });

  it("does not force Find Place for ordinary cafe queries", async () => {
    global.fetch = vi.fn(async () => ({
      json: async () => ({
        status: "OK",
        results: [{
          place_id: "cafe-id",
          formatted_address: "123 Kemp Blvd, Wichita Falls, TX, USA",
          geometry: { location: { lat: 33.91, lng: -98.49 } },
          types: ["cafe", "food", "establishment"],
        }],
      }),
    }));

    const result = await geocodeAddress("Ellen's Cafe, Wichita Falls, TX");
    expect(result).toMatchObject({ lat: 33.91, lng: -98.49 });
    expect(String(global.fetch.mock.calls[0][0])).toContain("geocode");
    expect(String(global.fetch.mock.calls[0][0])).not.toContain("findplacefromtext");
  });
});
