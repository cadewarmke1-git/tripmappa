import { describe, expect, it } from "vitest";
import {
  normalizeTripTips,
  splitTripTips,
  isBareWeatherTip,
  formatActionTipsBlock,
} from "./tripTips.js";

describe("tripTips", () => {
  it("normalizes legacy string tips", () => {
    const tips = normalizeTripTips(["Pack snacks for the drive"]);
    expect(tips[0].severity).toBe("info");
    expect(tips[0].title).toContain("Pack snacks");
  });

  it("caps action tips at two", () => {
    const tips = normalizeTripTips([
      { severity: "action", title: "A", detail: "1", action: { type: "reroute", label: "Go" } },
      { severity: "action", title: "B", detail: "2", action: { type: "reroute", label: "Go" } },
      { severity: "action", title: "C", detail: "3", action: { type: "reroute", label: "Go" } },
    ]);
    expect(tips.filter(t => t.severity === "action")).toHaveLength(2);
  });

  it("flags bare weather readings", () => {
    expect(isBareWeatherTip({ title: "Clear skies ahead", detail: "72°F" })).toBe(true);
    expect(isBareWeatherTip({ title: "Snow on I-70 grades", detail: "Chains required" })).toBe(false);
  });

  it("builds regeneration hint block from action tips", () => {
    const block = formatActionTipsBlock([
      { severity: "action", title: "Leave earlier", detail: "Beat storms", action: { type: "depart_earlier", label: "Adjust" } },
    ]);
    expect(block).toContain("TRIP TIP DIRECTIVES");
    expect(block).toContain("depart earlier");
  });

  it("splits tips by severity", () => {
    const split = splitTripTips([
      { severity: "action", title: "Act", detail: "" },
      { severity: "info", title: "Info", detail: "" },
    ]);
    expect(split.action).toHaveLength(1);
    expect(split.more).toHaveLength(1);
  });
});
