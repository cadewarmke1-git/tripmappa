import { describe, expect, it } from "vitest";
import { assertTripResultReady, canStartTripGeneration } from "./generateTripFlow.js";
import { parseTripApiResponse } from "./tripHandlers.js";

const noopFallback = () => ({
  stops: [{ city: "Fallback City" }],
  roadStops: [],
  tripTips: ["fallback tip"],
  hosCompliance: null,
  truckSafety: null,
  rvSafety: null,
});

describe("generateTripFlow", () => {
  it("blocks generation when questions are incomplete or route is missing", () => {
    expect(canStartTripGeneration({
      origin: "Dallas, TX",
      dest: "Austin, TX",
      convoComplete: false,
      creditsRemaining: 1,
    })).toEqual({ ok: false, reason: "incomplete_questions" });

    expect(canStartTripGeneration({
      origin: "",
      dest: "Austin, TX",
      convoComplete: true,
      creditsRemaining: 1,
    })).toEqual({ ok: false, reason: "missing_route" });
  });

  it("allows generation when route, questions, and credits are ready", () => {
    expect(canStartTripGeneration({
      origin: "Dallas, TX",
      dest: "Austin, TX",
      convoComplete: true,
      creditsRemaining: 1,
    })).toEqual({ ok: true });
  });

  it("always yields displayable stops from API or fallback parse", () => {
    const parsed = parseTripApiResponse(
      {
        stops: [{ city: "Amarillo, TX", name: "Amarillo" }],
        road_stops: [],
        tips: ["Drive safe"],
      },
      { vehicle: "Car" },
      {},
      noopFallback,
    );
    expect(assertTripResultReady(parsed)).toBe(true);

    const fallback = parseTripApiResponse({}, { vehicle: "Car" }, {}, noopFallback);
    expect(assertTripResultReady(fallback)).toBe(true);
    expect(fallback.usedFallback).toBe(true);
  });
});
