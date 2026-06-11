import { describe, expect, it } from "vitest";
import { sanitizeHintText, HINT_BLOCK_MAX } from "./hintSanitization.js";
import { formatGenerationHints } from "./tripConstraintsSummary.js";
import { formatActionTipsBlock } from "./tripTips.js";

describe("hintSanitization", () => {
  it("strips control characters and clamps length", () => {
    const dirty = `hello\u0007${"x".repeat(HINT_BLOCK_MAX + 50)}`;
    const clean = sanitizeHintText(dirty);
    expect(clean).not.toContain("\u0007");
    expect(clean.length).toBe(HINT_BLOCK_MAX);
  });

  it("sanitizes action tip hints block", () => {
    const block = formatActionTipsBlock([{
      severity: "action",
      title: "Storm ahead",
      detail: "Reroute north",
      action: { type: "reroute", label: "Reroute" },
    }]);
    expect(block).toContain("TRIP TIP DIRECTIVES");
    expect(block.length).toBeLessThanOrEqual(HINT_BLOCK_MAX);
  });

  it("sanitizes collaboration and action blocks in generation hints", () => {
    const hints = formatGenerationHints(
      { vehicle: "Car", trip_type: "Road trip" },
      { distance: "100 mi" },
      {
        actionTipHintsBlock: `=== TRIP TIP DIRECTIVES ===\n- MUST: Reroute\u0001 ${"a".repeat(3000)}`,
        collaborationHintsBlock: `=== GROUP ===\n- Guest: diet: Vegan`,
      },
    );
    expect(hints).not.toContain("\u0001");
    expect(hints.length).toBeLessThanOrEqual(12000);
  });
});
