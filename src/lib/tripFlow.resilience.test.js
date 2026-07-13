import { describe, expect, it } from "vitest";
import {
  getNextFlowQuestion,
  pruneStaleBranchAnswers,
} from "./tripFlow.js";

describe("tripFlow resilience", () => {
  const longTripContext = {
    origin: "Dallas, TX",
    destination: "Los Angeles, CA",
    routeDistance: "520 mi",
    routeDuration: "8 hours 15 mins",
    routeDistanceMiles: 520,
    routeDurationHours: 8.25,
  };

  it("continues truck branch into tail trip details questions", () => {
    const answers = {
      vehicle: "Semi Truck (18-wheeler)",
      hauling_type: "General freight",
      sleeper_cab: "Yes — I sleep in the cab",
      truck_stop_brand: "Love's",
      route_restrictions: ["No restrictions"],
    };
    const next = getNextFlowQuestion(answers, longTripContext);
    expect(next.id).toBe("trip_details");
  });

  it("skips standalone accessibility on the truck branch", () => {
    const answers = {
      vehicle: "Semi Truck (18-wheeler)",
      hauling_type: "General freight",
    };
    const next = getNextFlowQuestion(answers, longTripContext);
    expect(next.id).toBe("sleeper_cab");
  });

  it("unlocks overnight question when route calculation failed", () => {
    const answers = {
      vehicle: "Car",
      fuel_type: "Gasoline",
      towing: "No",
      travelers: "2",
      adult_count: 2,
      child_count: 0,
      stop_frequency: "Moderate",
      luxury_level: "3",
      stop_count: "A few (2-3)",
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

  it("multi-vehicle plane primary runs mini-flow before coordination", () => {
    const answers = {
      vehicle: "Multi-Vehicle Trip",
      multi_vehicles: ["Car", "Plane"],
      primary_vehicle: "Plane",
      travelers: "2",
      adult_count: 2,
      child_count: 0,
      dietary: [],
      stops_interests: ["Food and dining"],
      accessibility: [],
      schedule_restrictions: [],
      trip_budget: "No budget limit",
    };
    const next = getNextFlowQuestion(answers, longTripContext);
    expect(next.id).toBe("coordination_needs");
  });
});
