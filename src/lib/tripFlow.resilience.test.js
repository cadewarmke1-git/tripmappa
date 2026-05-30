import { describe, expect, it } from "vitest";
import {
  getNextFlowQuestion,
  pruneStaleBranchAnswers,
} from "./tripFlow.js";

describe("tripFlow resilience", () => {
  const longTripContext = {
    routeDistance: "520 mi",
    routeDuration: "8 hours 15 mins",
    routeDistanceMiles: 520,
    routeDurationHours: 8.25,
  };

  it("continues truck branch into tail trip details questions", () => {
    const answers = {
      vehicle: "Semi Truck (18-wheeler)",
      hauling_type: "General freight",
      sleeper_cab: "Yes I have a sleeper cab",
      truck_stop_brand: "Love's",
      route_restrictions: ["No restrictions"],
      accessibility: ["No special needs"],
    };
    const next = getNextFlowQuestion(answers, longTripContext);
    expect(next.id).toBe("trip_details");
  });

  it("unlocks overnight question when route calculation failed", () => {
    const answers = {
      vehicle: "Car",
      fuel_type: "Gasoline",
      towing: "No",
      travelers: "2",
      preferences: [],
    };
    const next = getNextFlowQuestion(answers, { ...longTripContext, routeFailed: true });
    expect(next.id).toBe("overnight_preference");
    expect(next.hint).toMatch(/couldn't calculate/i);
  });

  it("prunes truck-only answers after switching to a car", () => {
    const pruned = pruneStaleBranchAnswers(
      {
        vehicle: "Car",
        hauling_type: "General freight",
        truck_stop_brand: "Love's",
        overnight_preference: "Stop overnight along the way",
        lodging: "Mid-Range",
      },
      longTripContext,
    );
    expect(pruned.hauling_type).toBeUndefined();
    expect(pruned.truck_stop_brand).toBeUndefined();
    expect(pruned.overnight_preference).toBeDefined();
  });
});
