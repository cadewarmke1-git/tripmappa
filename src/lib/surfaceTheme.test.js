import { describe, expect, it } from "vitest";
import { resolveSkyCycleState } from "./surfaceTheme.js";

describe("surfaceTheme", () => {
  it("resolves day surface at midday", () => {
    expect(resolveSkyCycleState({ now: new Date("2026-05-23T12:00:00") })).toEqual({
      surfaceTheme: "day",
      skyPhase: "midday",
    });
  });

  it("resolves twilight surface during golden hour", () => {
    expect(resolveSkyCycleState({ now: new Date("2026-05-23T18:00:00") })).toEqual({
      surfaceTheme: "twilight",
      skyPhase: "golden_hour",
    });
  });

  it("resolves night surface late evening", () => {
    expect(resolveSkyCycleState({ now: new Date("2026-05-23T22:00:00") })).toEqual({
      surfaceTheme: "night",
      skyPhase: "night",
    });
  });
});
