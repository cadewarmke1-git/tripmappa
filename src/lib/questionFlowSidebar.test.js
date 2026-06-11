import { describe, expect, it } from "vitest";
import { getQuestionFlowSidebarLabel } from "./questionFlowSidebar.js";

describe("questionFlowSidebar", () => {
  it("maps known question ids to short uppercase labels", () => {
    expect(getQuestionFlowSidebarLabel({ id: "vehicle" })).toBe("VEHICLE");
    expect(getQuestionFlowSidebarLabel({ id: "fuel_type" })).toBe("FUEL");
    expect(getQuestionFlowSidebarLabel({ id: "towing" })).toBe("TOWING");
  });

  it("falls back to the first two words of the question", () => {
    expect(getQuestionFlowSidebarLabel({ id: "custom_q", ask: "Where should we stop?" })).toBe("WHERE SHOULD");
  });
});
