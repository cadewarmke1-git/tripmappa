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

  it("detects vehicle type changes", () => {
    const saved = buildPlanSnapshot({
      origin: "Austin, TX",
      dest: "Denver, CO",
      answers: { vehicle: "Car" },
    });
    const current = buildPlanSnapshot({
      origin: "Austin, TX",
      dest: "Denver, CO",
      answers: { vehicle: "RV" },
    });
    expect(isPlanOutOfDate(saved, current)).toBe(true);
  });

  it("ignores minor preference and route metric differences", () => {
    const saved = buildPlanSnapshot({
      origin: "Austin, TX",
      dest: "Denver, CO",
      answers: { vehicle: "Car", dietary: ["Vegetarian"], lodging: "Budget" },
      routeInfo: { distance: "900 mi", duration: "13 hr" },
    });
    const current = buildPlanSnapshot({
      origin: "Austin, TX",
      dest: "Denver, CO",
      answers: { vehicle: "Car", dietary: ["Vegan"], lodging: "Luxury" },
      routeInfo: { distance: "850 mi", duration: "12 hr" },
    });
    expect(isPlanOutOfDate(saved, current)).toBe(false);
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
