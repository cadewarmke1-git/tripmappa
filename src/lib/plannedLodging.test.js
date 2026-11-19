import { describe, expect, it } from "vitest";
import { mapPlannedHotelsToCards } from "./plannedLodging.js";

describe("mapPlannedHotelsToCards", () => {
  it("maps planner overnight hotels for HotelCard fallback", () => {
    const cards = mapPlannedHotelsToCards(
      [
        { name: "Hotel Indigo Waco", stars: 4, price: "$129", rating: 4.4, verified: true },
        { name: "Hotel Indigo Waco", stars: 4 },
        { name: "" },
      ],
      "Waco, TX",
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      name: "Hotel Indigo Waco",
      stars: 4,
      priceLabel: "$129",
      neighborhood: "Waco",
      fromPlanner: true,
      fromGooglePlaces: false,
      verified: true,
    });
  });

  it("returns empty for missing hotels", () => {
    expect(mapPlannedHotelsToCards(null, "Waco")).toEqual([]);
    expect(mapPlannedHotelsToCards([], "Waco")).toEqual([]);
  });
});
