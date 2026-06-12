import { describe, expect, it } from "vitest";
import { buildCorridorDistributionRules } from "./corridorStopDistribution.js";

describe("corridorStopDistribution", () => {
  it("requires stops along full corridor not only destination", () => {
    const rules = buildCorridorDistributionRules({
      fuel: "Gasoline",
      tripCategory: "personal",
      vehicle: "Car",
      routeMiles: 650,
    });
    expect(rules).toContain("FIRST THIRD");
    expect(rules).toContain("AT MOST 30%");
    expect(rules).toContain("60–120");
    expect(rules).toContain("200 miles");
  });

  it("includes EV spacing rules", () => {
    const rules = buildCorridorDistributionRules({
      fuel: "Electric (EV)",
      tripCategory: "personal",
      vehicle: "Car",
    });
    expect(rules).toContain("80% of safe EV range");
  });

  it("includes truck corridor guidance", () => {
    const rules = buildCorridorDistributionRules({
      fuel: "Diesel",
      tripCategory: "commercial",
      vehicle: "Semi Truck (18-wheeler)",
    });
    expect(rules).toContain("Truck route");
  });
});
