/** Dynamic max_tokens tier selection tests. */
import { describe, expect, it } from "vitest";
import { calculateMaxTokens } from "../../server/lib/planTripTokens.js";

function ctx(overrides = {}) {
  return {
    tripCategory: "personal",
    tripType: "Road trip",
    routeMiles: 0,
    ...overrides,
  };
}

describe("calculateMaxTokens", () => {
  it("returns 2048 for day trips under 150 miles", () => {
    const result = calculateMaxTokens(
      ctx({ routeMiles: 120 }),
      { trip_type: "Day trip" },
      { routeDistanceMiles: 120 },
      true,
    );
    expect(result).toEqual({ maxTokens: 2048, tier: "day_under_150_simplified" });
  });

  it("returns 2048 for plane and water", () => {
    expect(calculateMaxTokens(ctx({ tripCategory: "plane" }), {}, {}, true))
      .toEqual({ maxTokens: 2048, tier: "plane_water_simplified" });
    expect(calculateMaxTokens(ctx({ tripCategory: "water" }), {}, {}, true))
      .toEqual({ maxTokens: 2048, tier: "plane_water_simplified" });
  });

  it("returns 2048 for medium continuous trips 150-400 miles", () => {
    const result = calculateMaxTokens(
      ctx({ routeMiles: 280 }),
      { continuous_drive: true },
      { routeDistanceMiles: 280 },
      true,
    );
    expect(result).toEqual({ maxTokens: 2048, tier: "medium_150_400_no_overnight" });
  });

  it("returns 3072 for medium trip with one overnight", () => {
    const result = calculateMaxTokens(
      ctx({ routeMiles: 320 }),
      { trip_nights: "1 night" },
      { routeDistanceMiles: 320 },
      false,
    );
    expect(result).toEqual({ maxTokens: 3072, tier: "medium_1_overnight" });
  });

  it("returns 4096 for long 400-800 mile trips", () => {
    const result = calculateMaxTokens(
      ctx({ routeMiles: 620 }),
      { trip_nights: "2 nights" },
      { routeDistanceMiles: 620 },
      false,
    );
    expect(result).toEqual({ maxTokens: 4096, tier: "long_400_800" });
  });

  it("returns 5120 for very long stacked complexity trips", () => {
    const result = calculateMaxTokens(
      ctx({ routeMiles: 940 }),
      { trip_nights: "2 nights", child_count: 1, preferences: ["Pet friendly"], dietary: ["Gluten Free", "Vegan"] },
      { routeDistanceMiles: 940 },
      false,
    );
    expect(result).toEqual({ maxTokens: 5120, tier: "very_long_800plus_stacked" });
  });

  it("returns 4096 baseline for very long trips without stacking", () => {
    const result = calculateMaxTokens(
      ctx({ routeMiles: 940 }),
      { trip_nights: "2 nights", travelers: "2" },
      { routeDistanceMiles: 940 },
      false,
    );
    expect(result).toEqual({ maxTokens: 4096, tier: "very_long_800plus_baseline" });
  });

  it("returns 3072 for standard parallel segment calls", () => {
    const result = calculateMaxTokens(
      ctx({ isSegment: true, routeMiles: 664 }),
      { trip_nights: "1 night", travelers: "2" },
      { routeDistanceMiles: 664 },
      false,
    );
    expect(result).toEqual({ maxTokens: 3072, tier: "medium_1_overnight" });
  });

  it("returns 4096 for parallel segments with stacked family complexity", () => {
    const result = calculateMaxTokens(
      ctx({ isSegment: true, routeMiles: 957 }),
      {
        trip_nights: "2 nights",
        child_count: 2,
        preferences: ["Pet friendly", "Kid friendly stops"],
        dietary: ["Gluten Free"],
      },
      { routeDistanceMiles: 957 },
      false,
    );
    expect(result).toEqual({ maxTokens: 4096, tier: "segment_stacked_complexity" });
  });

  it("returns 4096 for parallel commercial truck segments", () => {
    const result = calculateMaxTokens(
      ctx({ isSegment: true, tripCategory: "commercial", routeMiles: 928 }),
      {
        vehicle: "Semi Truck (18-wheeler)",
        trip_nights: "2 nights",
        truck_stop_brand: "Love's",
      },
      { routeDistanceMiles: 928 },
      false,
    );
    expect(result).toEqual({ maxTokens: 4096, tier: "segment_commercial_truck" });
  });

  it("keeps 3072 for parallel personal vehicle segments without stacked complexity", () => {
    const result = calculateMaxTokens(
      ctx({ isSegment: true, tripCategory: "personal", routeMiles: 664 }),
      { trip_nights: "1 night", travelers: "2" },
      { routeDistanceMiles: 664 },
      false,
    );
    expect(result).toEqual({ maxTokens: 3072, tier: "medium_1_overnight" });
  });
});
