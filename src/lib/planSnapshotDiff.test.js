import { describe, it, expect } from "vitest";
import { buildPlanSnapshot } from "./planSnapshot.js";
import { describePlanChanges } from "./planSnapshotDiff.js";

describe("planSnapshotDiff", () => {
  it("lists origin and dietary changes", () => {
    const saved = buildPlanSnapshot({
      origin: "Austin, TX",
      dest: "Denver, CO",
      answers: { vehicle: "Car", dietary: [] },
      routeInfo: { distance: "900 mi", duration: "13 hr" },
    });
    const current = buildPlanSnapshot({
      origin: "Dallas, TX",
      dest: "Denver, CO",
      answers: { vehicle: "Car", dietary: ["Vegetarian"] },
      routeInfo: { distance: "850 mi", duration: "12 hr" },
    });
    const changes = describePlanChanges(saved, current);
    expect(changes.some(c => c.startsWith("Origin:"))).toBe(true);
    expect(changes.some(c => c.includes("dietary") || c.includes("Vegetarian"))).toBe(true);
  });
});
