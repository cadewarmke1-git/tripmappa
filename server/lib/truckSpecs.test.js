import { describe, it, expect } from "vitest";
import {
  parseHeightFeet,
  parseWeightLbs,
  feetToMeters,
  poundsToKilograms,
  resolveTruckRequestSpecs,
} from "./truckSpecs.js";

describe("truckSpecs", () => {
  it("parses 13'6\" as 13.5 feet and converts to 4.11m", () => {
    expect(parseHeightFeet("13'6\"")).toBeCloseTo(13.5, 2);
    expect(feetToMeters(parseHeightFeet("13'6\""))).toBeCloseTo(4.11, 2);
  });

  it("parses 80000 lbs to 36287 kg", () => {
    expect(parseWeightLbs("80,000 lbs")).toBe(80000);
    expect(poundsToKilograms(80000)).toBe(36287);
  });

  it("defaults commercial specs when omitted", () => {
    const specs = resolveTruckRequestSpecs({});
    expect(specs.heightFeet).toBeCloseTo(13.5, 2);
    expect(specs.weightLbs).toBe(80000);
    expect(specs.axleCount).toBe(5);
    expect(specs.hazmat).toBe(false);
  });
});
