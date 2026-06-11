import { describe, expect, it } from "vitest";
import {
  resolveHeroVariant,
  shouldShowRouteHighlightChips,
  classifyTripCategory,
} from "./resolveHeroVariant.js";

const TRUCK = { vehicle: "Semi Truck (18-wheeler)", trip_type: "Work or Delivery run" };
const SCENIC = { preferences: ["Scenic route"] };
const DAY = { trip_type: "Day trip", vehicle: "Car" };

describe("resolveHeroVariant", () => {
  it("returns truck for commercial trips", () => {
    expect(resolveHeroVariant(TRUCK, "commercial", [{ city: "Amarillo, TX" }])).toBe("truck");
  });

  it("returns multiDay for two or more nights", () => {
    const stops = [{ city: "Austin, TX" }, { city: "Dallas, TX" }];
    expect(resolveHeroVariant({ vehicle: "Car" }, "personal", stops)).toBe("multiDay");
  });

  it("returns overnight for exactly one night", () => {
    expect(resolveHeroVariant({ vehicle: "Car" }, "personal", [{ city: "Waco, TX" }])).toBe("overnight");
  });

  it("returns scenicDay for day trips with scenic preference", () => {
    expect(resolveHeroVariant({ ...DAY, ...SCENIC }, "personal", [])).toBe("scenicDay");
  });

  it("returns day otherwise", () => {
    expect(resolveHeroVariant(DAY, "personal", [])).toBe("day");
  });
});

describe("shouldShowRouteHighlightChips", () => {
  it("adds chips for scenic multi-night trips without replacing variant", () => {
    expect(shouldShowRouteHighlightChips({ ...SCENIC }, "multiDay")).toBe(true);
    expect(shouldShowRouteHighlightChips({ ...SCENIC }, "overnight")).toBe(true);
    expect(shouldShowRouteHighlightChips({ ...SCENIC }, "truck")).toBe(true);
    expect(shouldShowRouteHighlightChips({ ...SCENIC }, "scenicDay")).toBe(false);
    expect(shouldShowRouteHighlightChips({ ...SCENIC }, "day")).toBe(false);
  });
});

describe("classifyTripCategory", () => {
  it("classifies commercial truck trips", () => {
    expect(classifyTripCategory(TRUCK)).toBe("commercial");
  });
});
