import { describe, expect, it } from "vitest";
import {
  getFlowPhaseId,
  getFlowProgress,
  getNextFlowQuestion,
  isRouteContextReady,
  normalizeTripAnswers,
} from "./tripFlow.js";

describe("tripFlow UX", () => {
  const longTripContext = {
    routeDistance: "520 mi",
    routeDuration: "8 hours 15 mins",
    routeDistanceMiles: 520,
    routeDurationHours: 8.25,
  };

  it("detects when route context is ready", () => {
    expect(isRouteContextReady({ routeDistanceMiles: 200 })).toBe(true);
    expect(isRouteContextReady({ routeDistance: "100 mi" })).toBe(true);
    expect(isRouteContextReady({})).toBe(false);
  });

  const basePersonal = {
    vehicle: "Car",
    fuel_type: "Gasoline",
    towing: "No",
    travelers: "2",
  };

  it("asks route preferences before overnight on personal trips", () => {
    const next = getNextFlowQuestion(basePersonal, longTripContext);
    expect(next.id).toBe("preferences");
    expect(getFlowPhaseId(next.id)).toBe("route");
  });

  it("shows pending overnight when route context is missing", () => {
    const answers = { ...basePersonal, preferences: [] };
    const next = getNextFlowQuestion(answers, {});
    expect(next.id).toBe("overnight_preference");
    expect(next.pendingRoute).toBe(true);
  });

  it("includes route snapshot in overnight question copy", () => {
    const answers = { ...basePersonal, preferences: [] };
    const next = getNextFlowQuestion(answers, longTripContext);
    expect(next.id).toBe("overnight_preference");
    expect(next.ask).toMatch(/520 mi/);
    expect(next.choices[0].description).toBeTruthy();
  });

  it("combines trip details into one screen", () => {
    const answers = {
      ...basePersonal,
      preferences: [],
      overnight_preference: "Stop overnight along the way",
      lodging: "Mid-Range",
      loyalty_program: "No preference",
    };
    const next = getNextFlowQuestion(answers, longTripContext);
    expect(next.id).toBe("trip_details");
    expect(next.type).toBe("trip_details");
  });

  it("skips lodging when driving straight through", () => {
    const normalized = normalizeTripAnswers(
      {
        ...basePersonal,
        preferences: [],
        overnight_preference: "Drive straight through",
      },
      longTripContext,
    );
    expect(normalized.continuous_drive).toBe(true);
    const next = getNextFlowQuestion(normalized, longTripContext);
    expect(next.id).toBe("trip_details");
  });

  it("uses phase-based progress labels", () => {
    const progress = getFlowProgress({}, {}, { currentQuestionId: "travelers" });
    expect(progress.phases).toHaveLength(4);
    expect(progress.currentPhaseId).toBe("about");
    expect(progress.phaseLabel).toBe("Your trip");
  });
});
