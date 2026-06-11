import { describe, expect, it } from "vitest";
import {
  normalizeTripResponse,
  stripPlanningVocabularyFromName,
} from "./tripResponseNormalize.js";
import {
  stitchTripSegments,
  dedupeConsecutiveStops,
  assertNoConsecutiveDuplicateStops,
} from "./planTripSegments.js";
import { filterFoodCandidates } from "../../src/lib/placesFilters.js";
import { buildInitialItineraryWaypoints, countIncludedStops } from "../../src/lib/itineraryWaypoints.js";
import { countTimelineStopRows, buildJourneyTimeline } from "../../src/lib/buildJourneyTimeline.js";
import { buildItineraryDays } from "../../src/lib/itineraryDays.js";
import { resolveHeroStopCount } from "../../src/lib/heroVariantContent.js";
import { formatLodgingPriceLabel } from "../../src/lib/lodgingPlaces.js";
import { tripIncludesOvernight } from "../../src/lib/itineraryDays.js";

const PLACES_CTX = {
  corridor: [{
    restaurants: [
      { name: "Local Bistro", types: ["restaurant", "food"], rating: 4.6 },
    ],
  }],
  cities: [{
    city: "Little Rock, AR",
    hotels: [{ name: "Holiday Inn Little Rock", types: ["lodging", "hotel"], rating: 4.2 }],
    dietaryRestaurants: [{ name: "Gluten Free Kitchen", types: ["restaurant", "food"], rating: 4.5 }],
  }],
};

function normalizeFixture(raw) {
  return normalizeTripResponse(raw, { placesContext: PLACES_CTX });
}

describe("trip integrity — three verification scenarios", () => {
  it("Dallas → Nashville car gluten-free: food types, names, hero count, pricing", () => {
    const raw = {
      trip_format: "multi_day",
      stops: [{
        city: "Little Rock, AR",
        hotels: [{ name: "Holiday Inn Little Rock", price: "$110/night", verified: true }],
        restaurants: [{ name: "Gluten Free Kitchen", verified: true }],
      }],
      road_stops: [
        { name: "Local Bistro corridor vicinity", category: "food", distance: "200 mi", lat: 34.7, lng: -92.3 },
        { name: "Ford Dealership", category: "food", distance: "250 mi" },
      ],
    };
    const normalized = normalizeFixture(raw);
    expect(stripPlanningVocabularyFromName("Spring Creek Farms LLC corridor EV charging vicinity"))
      .toBe("Spring Creek Farms LLC EV charging");

    const foodStops = normalized.road_stops.filter(s => /food/i.test(s.category || ""));
    for (const stop of foodStops) {
      expect(stop.name.toLowerCase()).not.toMatch(/corridor|vicinity/);
    }
    expect(normalized.road_stops.find(s => /ford/i.test(s.name))).toBeUndefined();

    const waypoints = buildInitialItineraryWaypoints({
      origin: "Dallas, TX",
      dest: "Nashville, TN",
      routeInfo: { distance: "670 mi", duration: "10 hr" },
      stops: normalized.stops,
      roadStops: normalized.road_stops,
      answers: { trip_type: "Road trip", lodging: "Mid-Range", dietary: ["Gluten Free"] },
    });
    const heroCount = resolveHeroStopCount({ waypoints, stops: normalized.stops, roadStops: normalized.road_stops });
    expect(heroCount).toBe(countIncludedStops(waypoints));

    const priceLabel = formatLodgingPriceLabel({ priceLevel: 2, price_band: "mid" }, { lodging: "Mid-Range" });
    expect(priceLabel).not.toMatch(/^\$110\/night$/);
    expect(priceLabel).toContain("Mid-range");
  });

  it("Dallas → Chicago truck: stitch dedupes overnight boundary", () => {
    const stitched = stitchTripSegments([
      {
        trip_format: "multi_day",
        stops: [{ city: "Oklahoma City, OK", lat: 35.47, lng: -97.51 }],
        road_stops: [{ name: "Love's Travel Stop", distance: "200 mi", lat: 35.4, lng: -97.6 }],
        tips: [],
      },
      {
        trip_format: "multi_day",
        stops: [{ city: "Oklahoma City, OK", lat: 35.47, lng: -97.51 }],
        road_stops: [{ name: "Pilot Travel Center", distance: "420 mi" }],
        tips: [],
      },
    ]);
    expect(stitched.stops).toHaveLength(1);
    expect(() => assertNoConsecutiveDuplicateStops(stitched.stops)).not.toThrow();
    expect(() => assertNoConsecutiveDuplicateStops(stitched.road_stops)).not.toThrow();
  });

  it("Dallas → Asheville family: day trip gates overnight sections", () => {
    expect(tripIncludesOvernight([], { trip_type: "Day trip", lodging: "Mid-Range" })).toBe(false);
    expect(tripIncludesOvernight([{ city: "Memphis, TN" }], { trip_type: "Road trip", lodging: "Mid-Range" })).toBe(true);
  });
});

describe("dedupeConsecutiveStops", () => {
  it("removes same-name stops within half mile", () => {
    const out = dedupeConsecutiveStops([
      { name: "Oklahoma City, OK", city: "Oklahoma City, OK", lat: 35.47, lng: -97.51 },
      { name: "Oklahoma City, OK", city: "Oklahoma City, OK", lat: 35.471, lng: -97.511 },
    ]);
    expect(out).toHaveLength(1);
  });
});

describe("prefetch food filter integration", () => {
  it("never offers car_dealer as restaurant candidate", () => {
    const candidates = filterFoodCandidates([
      { name: "Ford", types: ["car_dealer", "store"] },
      { name: "Hotel Cafe", types: ["lodging", "hotel"] },
      { name: "Real Cafe", types: ["cafe", "food"] },
    ]);
    expect(candidates.map(c => c.name)).toEqual(["Real Cafe"]);
  });
});
