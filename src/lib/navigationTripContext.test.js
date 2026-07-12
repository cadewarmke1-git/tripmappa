import { describe, it, expect } from "vitest";
import {
  buildNextStopContext,
  buildFuelRangeAdvisory,
  findCityData,
} from "./navigationTripContext.js";

describe("navigationTripContext", () => {
  it("findCityData matches city prefix", () => {
    const map = { "Chicago, IL": { temperatureDisplay: "72°F" } };
    expect(findCityData(map, "Chicago, IL")).toBeTruthy();
    expect(findCityData(map, "Chicago")).toBeTruthy();
  });

  it("buildNextStopContext includes lodging and dietary meal for overnight", () => {
    const ctx = buildNextStopContext(
      { id: "s1", title: "Springfield", city: "Springfield, IL", role: "overnight", kind: "stop" },
      {
        selectedLodging: [{ name: "Route 66 Inn", city: "Springfield, IL" }],
        weatherByCity: { "Springfield, IL": { temperatureDisplay: "68°F", condition: "Clear" } },
        restaurantsByCity: { "Springfield, IL": [{ name: "Green Garden", types: ["vegetarian"] }] },
        answers: { dietary: ["Vegetarian"] },
      },
    );
    expect(ctx.kind).toBe("Overnight");
    expect(ctx.weather?.temp).toBe("68°F");
    expect(ctx.lines.some((l) => l.text.includes("Route 66 Inn"))).toBe(true);
    expect(ctx.lines.some((l) => l.text.includes("Green Garden"))).toBe(true);
  });

  it("buildFuelRangeAdvisory warns when range is tight", () => {
    const routePoints = Array.from({ length: 11 }, (_, i) => ({ lat: 41 + i * 0.1, lng: -87 }));
    const advisory = buildFuelRangeAdvisory({
      userPosition: { lat: 41.9, lng: -87 },
      answers: { vehicle: "Car", fuel_type: "Gas" },
      roadStops: [
        { id: "f1", name: "Pilot", category: "fuel", lat: 42.5, lng: -87 },
      ],
      routePoints,
      routeInfo: { distance: "500 mi" },
      passedStopIds: new Set(),
    });
    expect(advisory).toBeTruthy();
    expect(advisory.rangeLeftMi).toBeLessThan(300);
    expect(advisory.nextFuelStop).toBe("Pilot");
  });
});
