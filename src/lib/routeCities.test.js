import { describe, expect, it } from "vitest";
import {
  parseCityStateFromFormattedAddress,
  cityStateFromGeocodeComponents,
} from "./routeCities.js";

describe("routeCities", () => {
  it("parseCityStateFromFormattedAddress extracts city and state", () => {
    expect(parseCityStateFromFormattedAddress("Amarillo, TX 79101, USA")).toBe("Amarillo, TX");
    expect(parseCityStateFromFormattedAddress("Dallas, TX")).toBe("Dallas, TX");
  });

  it("cityStateFromGeocodeComponents reads locality and state", () => {
    const cityState = cityStateFromGeocodeComponents([
      { long_name: "Amarillo", types: ["locality"] },
      { short_name: "TX", types: ["administrative_area_level_1"] },
    ]);
    expect(cityState).toBe("Amarillo, TX");
  });
});
