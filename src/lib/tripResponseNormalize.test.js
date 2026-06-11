import { describe, expect, it } from "vitest";
import {
  normalizeTripResponse,
  collectVerifiedPlaceNames,
  nameMatchesVerifiedPlace,
} from "../../server/lib/tripResponseNormalize.js";

describe("normalizeTripResponse", () => {
  it("coerces route_summary object to string", () => {
    const out = normalizeTripResponse({
      trip_format: "multi_day",
      route_summary: { text: "Dallas to Asheville" },
      stops: [{ city: "Memphis, TN" }],
      road_stops: [],
    });
    expect(typeof out.route_summary).toBe("string");
    expect(out.route_summary).toContain("Dallas");
  });

  it("wraps tips string in array", () => {
    const out = normalizeTripResponse({
      trip_format: "simplified",
      tips: "One tip",
      road_stops: [{ location: "Austin, TX", name: "Stop" }],
    });
    expect(Array.isArray(out.tips)).toBe(true);
    expect(out.tips[0]).toBe("One tip");
  });

  it("marks verified hotels against placesContext names", () => {
    const placesContext = {
      cities: [{
        city: "Amarillo, TX",
        hotels: [{ name: "Holiday Inn Express Amarillo" }],
      }],
    };
    const out = normalizeTripResponse({
      trip_format: "multi_day",
      stops: [{
        city: "Amarillo, TX",
        hotels: [
          { name: "Holiday Inn Express Amarillo", price: "$99/night" },
          { name: "Invented Hotel", price: "$120/night" },
        ],
      }],
      road_stops: [],
    }, { placesContext });

    expect(out.stops[0].hotels[0].verified).toBe(true);
    expect(out.stops[0].hotels[0].price_band).toBe("mid");
    expect(out.stops[0].hotels[1].verified).toBe(false);
  });

  it("adds verification_note on unverified restaurants", () => {
    const out = normalizeTripResponse({
      trip_format: "multi_day",
      stops: [{
        city: "Amarillo, TX",
        restaurants: [{ name: "Invented Cafe", cuisine: "American" }],
      }],
      road_stops: [],
    }, { placesContext: { cities: [{ hotels: [] }] } });
    expect(out.stops[0].restaurants[0].verified).toBe(false);
    expect(out.stops[0].restaurants[0].verification_note).toBeTruthy();
  });

  it("infers luxury price_band at $200+", () => {
    const out = normalizeTripResponse({
      trip_format: "multi_day",
      stops: [{
        city: "Austin, TX",
        hotels: [{ name: "Grand Hotel", price: "$225/night" }],
      }],
      road_stops: [],
    });
    expect(out.stops[0].hotels[0].price_band).toBe("luxury");
  });

  it("passes through personal_touches and changes_made arrays", () => {
    const out = normalizeTripResponse({
      trip_format: "multi_day",
      personal_touches: ["Halal dining near overnight stops"],
      changes_made: ["Swapped lodging for RV hookups"],
      stops: [],
      road_stops: [],
    });
    expect(out.personal_touches).toEqual(["Halal dining near overnight stops"]);
    expect(out.changes_made).toEqual(["Swapped lodging for RV hookups"]);
  });
});

describe("collectVerifiedPlaceNames", () => {
  it("collects corridor and city hotel names", () => {
    const names = collectVerifiedPlaceNames({
      corridor: [{ restaurants: [{ name: "Blue Mesa Grill" }] }],
      cities: [{ hotels: [{ name: "Drury Inn" }] }],
    });
    expect(nameMatchesVerifiedPlace("Blue Mesa Grill", names)).toBe(true);
    expect(nameMatchesVerifiedPlace("Drury Inn & Suites", names)).toBe(true);
    expect(nameMatchesVerifiedPlace("Fake Place", names)).toBe(false);
  });
});
