import { describe, it, expect } from "vitest";
import { buildPlanSnapshot, isPlanOutOfDate } from "./planSnapshot.js";

describe("planSnapshot", () => {
  it("detects origin changes after generation", () => {
    const saved = buildPlanSnapshot({
      origin: "Austin, TX",
      dest: "Denver, CO",
      answers: { vehicle: "Car", lodging: "Mid-Range" },
      routeInfo: { distance: "900 mi", duration: "13 hr" },
    });
    const current = buildPlanSnapshot({
      origin: "Dallas, TX",
      dest: "Denver, CO",
      answers: { vehicle: "Car", lodging: "Mid-Range" },
      routeInfo: { distance: "900 mi", duration: "13 hr" },
    });
    expect(isPlanOutOfDate(saved, current)).toBe(true);
  });

  it("ignores when snapshots match", () => {
    const state = {
      origin: "Austin, TX",
      dest: "Denver, CO",
      answers: { vehicle: "Car", dietary: ["Vegetarian"] },
      routeInfo: { distance: "900 mi", duration: "13 hr" },
    };
    const saved = buildPlanSnapshot(state);
    const current = buildPlanSnapshot(state);
    expect(isPlanOutOfDate(saved, current)).toBe(false);
  });
});
