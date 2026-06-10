import { describe, it, expect } from "vitest";
import { buildPlanSnapshot } from "./planSnapshot.js";
import { describePlanChanges, formatRegenerateDiffBlock, describeRegenerateChanges } from "./planSnapshotDiff.js";

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

  it("formats plain-English regenerate changes", () => {
    const saved = JSON.stringify({ answers: { vehicle: "Car", overnight_preference: "Stop overnight along the way" } });
    const current = JSON.stringify({ answers: { vehicle: "RV", overnight_preference: "Drive straight through" } });
    const changes = describeRegenerateChanges(saved, current);
    expect(changes).toContain("Vehicle changed from Car to RV");
    expect(changes).toContain("Overnight preference changed to Drive straight through");
    const block = formatRegenerateDiffBlock(saved, current);
    expect(block).toContain("REGENERATION DIRECTIVES");
    expect(block).toContain("YOU MUST:");
    expect(block).toContain("changes_made");
    expect(block).toContain("Vehicle changed from Car to RV");
  });
});
