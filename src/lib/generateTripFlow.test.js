import { describe, expect, it } from "vitest";
import {
  assertTripResultReady,
  canStartTripGeneration,
  generationFailureMessage,
  isTripPlanComplete,
} from "./generateTripFlow.js";
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

  it("accepts real API stops or road stops and rejects client fallback", () => {
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
    expect(isTripPlanComplete(parsed)).toBe(true);
    expect(assertTripResultReady(parsed)).toBe(true);

    const roadOnly = parseTripApiResponse(
      { road_stops: [{ name: "Rest area", city: "Amarillo, TX" }], tips: [] },
      { vehicle: "Car" },
      {},
      noopFallback,
    );
    expect(isTripPlanComplete(roadOnly)).toBe(true);

    const fallback = parseTripApiResponse({}, { vehicle: "Car" }, {}, noopFallback);
    expect(isTripPlanComplete(fallback)).toBe(false);
    expect(fallback.usedFallback).toBe(true);
  });

  it("returns a user-facing message for planner failures", () => {
    expect(generationFailureMessage(new Error("Trip planner returned incomplete results")))
      .toMatch(/complete trip plan/i);
    expect(generationFailureMessage(new Error("network"))).toMatch(/try again/i);
  });
});
