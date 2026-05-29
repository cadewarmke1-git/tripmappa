import { describe, expect, it } from "vitest";
import { resolveWeatherIconType } from "./weatherIconTypes.js";

describe("resolveWeatherIconType", () => {
  it("maps common weather conditions to stable slugs", () => {
    expect(resolveWeatherIconType("THUNDERSTORM")).toBe("storm");
    expect(resolveWeatherIconType("Light Rain")).toBe("rain");
    expect(resolveWeatherIconType("Partly Cloudy")).toBe("partly-cloudy");
    expect(resolveWeatherIconType("Clear")).toBe("clear");
  });

  it("returns default for unknown conditions", () => {
    expect(resolveWeatherIconType(null)).toBe("default");
    expect(resolveWeatherIconType("Alien Weather")).toBe("default");
  });
});
