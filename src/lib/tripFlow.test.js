import { describe, expect, it } from "vitest";
import {
  getFlowPhaseId,
  getFlowProgress,
  getNextFlowQuestion,
  isRouteContextReady,
  normalizeTripAnswers,
} from "./tripFlow.js";
import { DIETARY_CHOICES } from "./tripAccommodations.js";

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
    expect(next.id).toBe("trip_nights");
    const afterNights = { ...answers, trip_nights: "2 nights" };
    expect(getNextFlowQuestion(afterNights, longTripContext).id).toBe("trip_details");
    expect(getNextFlowQuestion(afterNights, longTripContext).type).toBe("trip_details");
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

  it("asks overnight before lodging on medium trips", () => {
    const mediumContext = {
      routeDistance: "220 mi",
      routeDuration: "4 hours 30 mins",
      routeDistanceMiles: 220,
      routeDurationHours: 4.5,
    };
    const answers = {
      ...basePersonal,
      preferences: [],
    };
    expect(getNextFlowQuestion(answers, mediumContext).id).toBe("overnight_preference");
    const afterOvernight = {
      ...answers,
      overnight_preference: "Stop overnight along the way",
    };
    expect(getNextFlowQuestion(afterOvernight, mediumContext).id).toBe("lodging");
  });

  it("skips lodging when overnight preference was not selected", () => {
    const mediumContext = {
      routeDistance: "220 mi",
      routeDuration: "4 hours 30 mins",
      routeDistanceMiles: 220,
      routeDurationHours: 4.5,
    };
    const answers = {
      ...basePersonal,
      preferences: [],
    };
    expect(getNextFlowQuestion(answers, mediumContext).id).toBe("overnight_preference");
  });

  it("uses phase-based progress labels", () => {
    const progress = getFlowProgress({}, {}, { currentQuestionId: "travelers" });
    expect(progress.phases).toHaveLength(4);
    expect(progress.currentPhaseId).toBe("about");
    expect(progress.phaseLabel).toBe("Your trip");
  });

  it("plane path collects travelers before completing", () => {
    const next = getNextFlowQuestion({ vehicle: "Plane" }, longTripContext);
    expect(next.id).toBe("travelers");
    expect(next.done).toBeFalsy();
  });

  it("plane path completes after mini-flow", () => {
    const answers = {
      vehicle: "Plane",
      travelers: "2",
      dietary: [],
      stops_interests: ["Cities and culture"],
      accessibility: [],
      schedule_restrictions: [],
      trip_budget: "No budget limit",
    };
    const next = getNextFlowQuestion(answers, longTripContext);
    expect(next.done).toBe(true);
    expect(next.skipMessage).toMatch(/airport/i);
  });

  it("boat path omits destination interests from trip details", () => {
    const next = getNextFlowQuestion({ vehicle: "Boat", travelers: "2" }, longTripContext);
    expect(next.id).toBe("trip_details");
    expect(next.sections.some((s) => s.id === "stops_interests")).toBe(false);
  });

  it("shows unlocked overnight when route context was skipped", () => {
    const answers = {
      ...basePersonal,
      preferences: [],
      route_context_unavailable: true,
    };
    const next = getNextFlowQuestion(answers, {});
    expect(next.id).toBe("overnight_preference");
    expect(next.pendingRoute).toBeFalsy();
  });

  it("shows medium-trip hint on overnight question for 3.5–6 hr routes", () => {
    const mediumContext = {
      routeDistance: "220 mi",
      routeDuration: "4 hours 30 mins",
      routeDistanceMiles: 220,
      routeDurationHours: 4.5,
    };
    const next = getNextFlowQuestion({ ...basePersonal, preferences: [] }, mediumContext);
    expect(next.mediumTripHint).toMatch(/one day/i);
  });

  it("omits medium-trip hint on long routes over 6 hours", () => {
    const next = getNextFlowQuestion({ ...basePersonal, preferences: [] }, longTripContext);
    expect(next.mediumTripHint).toBeFalsy();
  });

  it("multi-vehicle with RV primary runs RV branch then coordination", () => {
    const answers = {
      vehicle: "Multi-Vehicle Trip",
      multi_vehicles: ["Car", "RV"],
      primary_vehicle: "RV",
    };
    expect(getNextFlowQuestion(answers, longTripContext).id).toBe("fuel_type");
    const afterRv = {
      ...answers,
      fuel_type: "Gasoline",
      travelers: "2",
      preferences: ["Scenic route"],
    };
    expect(getNextFlowQuestion(afterRv, longTripContext).id).toBe("trip_nights");
    const afterNights = { ...afterRv, trip_nights: "2 nights" };
    expect(getNextFlowQuestion(afterNights, longTripContext).id).toBe("trip_details");
    const afterDetails = {
      ...afterNights,
      dietary: [],
      stops_interests: [],
      accessibility: [],
      schedule_restrictions: [],
      trip_budget: "No budget limit",
    };
    expect(getNextFlowQuestion(afterDetails, longTripContext).id).toBe("coordination_needs");
  });

  it("multi-vehicle with truck primary runs truck branch not car overnight", () => {
    const answers = {
      vehicle: "Multi-Vehicle Trip",
      multi_vehicles: ["Car", "Semi Truck (18-wheeler)"],
      primary_vehicle: "Semi Truck (18-wheeler)",
    };
    expect(getNextFlowQuestion(answers, longTripContext).id).toBe("hauling_type");
    const afterTruck = {
      ...answers,
      hauling_type: "General freight",
      sleeper_cab: "Yes I have a sleeper cab",
      truck_stop_brand: "No preference",
      route_restrictions: ["No restrictions"],
      dietary: [],
      stops_interests: [],
      accessibility: [],
      schedule_restrictions: [],
      trip_budget: "No budget limit",
    };
    const next = getNextFlowQuestion(afterTruck, longTripContext);
    expect(next.id).toBe("coordination_needs");
    expect(next.id).not.toBe("overnight_preference");
  });

  it("uses neutral vehicle question copy", () => {
    const next = getNextFlowQuestion({}, longTripContext);
    expect(next.ask).toBe("How are you traveling?");
  });

  it("asks party composition after larger traveler buckets", () => {
    const next = getNextFlowQuestion(
      { vehicle: "Plane", travelers: "3 to 5" },
      longTripContext,
    );
    expect(next.id).toBe("party_composition");
    expect(next.type).toBe("party_composition");
  });

  it("omits Halal and Kosher from per-trip dietary choices", () => {
    expect(DIETARY_CHOICES).not.toContain("Halal");
    expect(DIETARY_CHOICES).not.toContain("Kosher");
  });

  it("asks trip_nights on long RV routes after preferences", () => {
    const answers = {
      vehicle: "RV",
      fuel_type: "Gasoline",
      travelers: "2",
      preferences: ["Pet friendly"],
    };
    expect(getNextFlowQuestion(answers, longTripContext).id).toBe("trip_nights");
  });

  it("skips trip_nights on day-trip RV routes", () => {
    const dayContext = {
      routeDistance: "80 mi",
      routeDuration: "1 hour 30 mins",
      routeDistanceMiles: 80,
      routeDurationHours: 1.5,
    };
    const answers = {
      vehicle: "RV",
      fuel_type: "Gasoline",
      travelers: "2",
      preferences: ["Pet friendly"],
    };
    expect(getNextFlowQuestion(answers, dayContext).id).toBe("trip_details");
  });

  it("includes music_nightlife in plane destination interest choices", () => {
    const next = getNextFlowQuestion({ vehicle: "Plane", travelers: "2" }, longTripContext);
    const destSection = next.sections?.find(s => s.id === "stops_interests");
    const musicChoice = destSection?.choices?.find(c => c?.value === "music_nightlife");
    expect(musicChoice?.label).toBe("Music and nightlife");
  });

  it("normalizes plane schedule restrictions to travel wording", () => {
    const normalized = normalizeTripAnswers({
      vehicle: "Plane",
      schedule_restrictions: ["Drive only during specific hours — I will specify"],
    }, longTripContext);
    expect(normalized.schedule_restrictions).toEqual([
      "Travel only during specific hours — I will specify",
    ]);
  });
});
