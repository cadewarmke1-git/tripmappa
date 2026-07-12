import { describe, it, expect } from "vitest";
import { simplifyNavigationInstruction, simplifyThenPreview } from "./navigationSteps.js";

describe("simplifyNavigationInstruction", () => {
  it("strips parentheticals and business references", () => {
    const raw = "Keep left to stay on I-35 S, follow signs for Austin Pass by Motel 6 Austin, TX - North Central (on the right in 26.4 mi)";
    expect(simplifyNavigationInstruction(raw, "I-35 S")).toBe("Keep left on I-35 S");
  });

  it("shortens then preview to maneuver and road", () => {
    expect(simplifyThenPreview("Turn right onto Main St toward downtown", "Main St", "turn-right"))
      .toBe("Turn right · Main St");
  });
});
