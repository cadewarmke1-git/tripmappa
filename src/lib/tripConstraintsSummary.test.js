import { describe, it, expect } from "vitest";
import { buildTripConstraints, formatGenerationHints } from "./tripConstraintsSummary.js";

describe("tripConstraintsSummary", () => {
  it("includes dietary and schedule in constraints", () => {
    const items = buildTripConstraints({
      vehicle: "Car",
      dietary: ["Halal"],
      schedule_restrictions: ["Cannot travel on Saturdays — Sabbath observant"],
      travelers: "2",
    }, { distance: "400 mi", duration: "6 hr" });
    expect(items.some(i => i.id === "dietary")).toBe(true);
    expect(items.some(i => i.id === "schedule")).toBe(true);
  });

  it("formats generation hints with MUST rules", () => {
    const hints = formatGenerationHints({
      dietary: ["Vegan"],
      accessibility: ["Dialysis centers along route"],
      towing: "Yes — large trailer",
    });
    expect(hints).toContain("MUST");
    expect(hints).toContain("Dialysis");
    expect(hints).toContain("trailer");
  });
});
