import { describe, expect, it } from "vitest";
import {
  buildTruckLodgingQuestion,
  dedupeQuestionHistoryById,
  getAssumedTruckLodgingPill,
  getFlowPhaseId,
  getFlowProgress,
  getNextFlowQuestion,
  getPlanFlowLayoutClass,
  isRouteContextReady,
  normalizeTripAnswers,
  TRUCK_LODGING_CHOICES,
} from "./tripFlow.js";
import { OVERNIGHT_PREFERENCE_OVERNIGHT } from "./driveMode.js";
import { DIETARY_CHOICES } from "./tripAccommodations.js";

describe("tripFlow UX", () => {
  const routeEndpoints = { origin: "Dallas, TX", destination: "Los Angeles, CA" };

  const longTripContext = {
    ...routeEndpoints,
    routeDistance: "520 mi",
    routeDuration: "8 hours 15 mins",
    routeDistanceMiles: 520,
    routeDurationHours: 8.25,
  };

  it("asks route setup before vehicle when endpoints are missing", () => {
    const next = getNextFlowQuestion({}, {});
    expect(next.id).toBe("route_setup");
    expect(next.type).toBe("route_setup");
  });

  it("uses sparse layout for route setup so FROM/TO are not clipped", () => {
    expect(getPlanFlowLayoutClass({ id: "route_setup", type: "route_setup" })).toBe("sparse");
  });

  it("asks vehicle after route endpoints exist", () => {
    const next = getNextFlowQuestion({}, routeEndpoints);
    expect(next.id).toBe("vehicle");
  });

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
    adult_count: 2,
    child_count: 0,
    stop_frequency: "Moderate",
    luxury_level: "3",
    stop_count: "A few (2-3)",
  };

  it("asks route preferences before overnight on personal trips", () => {
    const next = getNextFlowQuestion(basePersonal, longTripContext);
    expect(next.id).toBe("preferences");
    expect(getFlowPhaseId(next.id)).toBe("route");
  });

  it("skips towing and route preferences on day trips", () => {
    const dayContext = {
      ...routeEndpoints,
      routeDistance: "80 mi",
      routeDuration: "1 hour 30 mins",
      routeDistanceMiles: 80,
      routeDurationHours: 1.5,
    };
    expect(getNextFlowQuestion({ vehicle: "Car", fuel_type: "Gasoline" }, dayContext).id).toBe("travelers");
    const withTravelers = {
      vehicle: "Car",
      fuel_type: "Gasoline",
      travelers: "2",
      adult_count: 2,
      child_count: 0,
      stop_frequency: "Moderate",
      luxury_level: "3",
      stop_count: "A few (2-3)",
    };
    expect(getNextFlowQuestion(withTravelers, dayContext).id).toBe("trip_details");
  });

  it("asks stop frequency after travelers and party details", () => {
    const next = getNextFlowQuestion(
      {
        vehicle: "Car",
        fuel_type: "Gasoline",
        towing: "No",
        travelers: "2",
        adult_count: 2,
        child_count: 0,
      },
      longTripContext,
    );
    expect(next.id).toBe("stop_frequency");
  });

  it("asks luxury level after stop frequency", () => {
    const next = getNextFlowQuestion(
      {
        vehicle: "Car",
        fuel_type: "Gasoline",
        towing: "No",
        travelers: "2",
        adult_count: 2,
        child_count: 0,
        stop_frequency: "Moderate",
      },
      longTripContext,
    );
    expect(next.id).toBe("luxury_level");
    expect(next.display).toBe("star_rating");
  });

  it("asks party composition after 2 travelers", () => {
    const next = getNextFlowQuestion(
      { vehicle: "Car", fuel_type: "Gasoline", towing: "No", travelers: "2 travelers" },
      longTripContext,
    );
    expect(next.id).toBe("party_composition");
  });

  it("asks kids ages right after party composition", () => {
    const next = getNextFlowQuestion(
      { ...basePersonal, travelers: "3 to 5", adult_count: 2, child_count: 1 },
      longTripContext,
    );
    expect(next.id).toBe("kids_ages");
  });

  it("asks kids ages after 2 travelers when party includes a child", () => {
    const next = getNextFlowQuestion(
      { ...basePersonal, travelers: "2 travelers", adult_count: 1, child_count: 1 },
      longTripContext,
    );
    expect(next.id).toBe("kids_ages");
  });

  it("shows overnight with pending route when drive time is unknown", () => {
    const answers = { ...basePersonal, preferences: [] };
    const next = getNextFlowQuestion(answers, { origin: "Dallas, TX", destination: "Los Angeles, CA" });
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
    };
    const next = getNextFlowQuestion(answers, longTripContext);
    expect(next.id).toBe("trip_nights");
    const afterNights = { ...answers, trip_nights: "2 nights" };
    expect(getNextFlowQuestion(afterNights, longTripContext).id).toBe("lodging");
    const afterLodging = {
      ...afterNights,
      lodging: "Mid-Range",
      loyalty_program: "No preference",
    };
    expect(getNextFlowQuestion(afterLodging, longTripContext).id).toBe("trip_details");
    expect(getNextFlowQuestion(afterLodging, longTripContext).type).toBe("trip_details");
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
      ...routeEndpoints,
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
    expect(getNextFlowQuestion(afterOvernight, mediumContext).id).toBe("trip_nights");
  });

  it("skips lodging when overnight preference was not selected", () => {
    const mediumContext = {
      ...routeEndpoints,
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
    expect(progress.stepIndex).toBe(1);
    expect(progress.stepTotal).toBe(4);
  });

  it("shows pending overnight instead of skipping before drive time is known", () => {
    const answers = { ...basePersonal, preferences: [] };
    const ctx = { origin: "A", destination: "B" };
    const next = getNextFlowQuestion(answers, ctx);
    expect(next.id).toBe("overnight_preference");
    expect(next.pendingRoute).toBe(true);
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
      adult_count: 2,
      child_count: 0,
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

  it("boat path includes destination interests in trip details", () => {
    const next = getNextFlowQuestion(
      { vehicle: "Boat", travelers: "2", adult_count: 2, child_count: 0 },
      longTripContext,
    );
    expect(next.id).toBe("trip_details");
    expect(next.sections.some((s) => s.id === "stops_interests")).toBe(true);
  });

  it("shows unlocked overnight when route context was skipped", () => {
    const answers = {
      ...basePersonal,
      preferences: [],
      route_context_unavailable: true,
    };
    const next = getNextFlowQuestion(answers, { origin: "Dallas, TX", destination: "Los Angeles, CA" });
    expect(next.id).toBe("overnight_preference");
    expect(next.pendingRoute).toBeFalsy();
  });

  it("shows medium-trip hint on overnight question for 3.5–6 hr routes", () => {
    const mediumContext = {
      ...routeEndpoints,
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
      adult_count: 2,
      child_count: 0,
      stop_frequency: "Moderate",
      luxury_level: "3",
      stop_count: "A few (2-3)",
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
      sleeper_cab: "Yes — I sleep in the cab",
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
      adult_count: 2,
      child_count: 0,
      stop_frequency: "Moderate",
      luxury_level: "3",
      stop_count: "A few (2-3)",
      preferences: ["Pet friendly"],
    };
    expect(getNextFlowQuestion(answers, longTripContext).id).toBe("trip_nights");
  });

  it("skips trip_nights on day-trip RV routes", () => {
    const dayContext = {
      ...routeEndpoints,
      routeDistance: "80 mi",
      routeDuration: "1 hour 30 mins",
      routeDistanceMiles: 80,
      routeDurationHours: 1.5,
    };
    const answers = {
      vehicle: "RV",
      fuel_type: "Gasoline",
      travelers: "2",
      adult_count: 2,
      child_count: 0,
      stop_frequency: "Moderate",
      luxury_level: "3",
      stop_count: "A few (2-3)",
      preferences: ["Pet friendly"],
    };
    expect(getNextFlowQuestion(answers, dayContext).id).toBe("trip_details");
  });

  it("includes music_nightlife in plane destination interest choices", () => {
    const next = getNextFlowQuestion(
      { vehicle: "Plane", travelers: "2", adult_count: 2, child_count: 0 },
      longTripContext,
    );
    const destSection = next.sections?.find(s => s.id === "stops_interests");
    const musicChoice = destSection?.choices?.find(c => c?.value === "music_nightlife");
    expect(musicChoice?.label).toBe("Music and nightlife");
  });

  it("includes destination interests for boat trips", () => {
    const next = getNextFlowQuestion(
      { vehicle: "Boat", travelers: "2", adult_count: 2, child_count: 0 },
      longTripContext,
    );
    const destSection = next.sections?.find(s => s.id === "stops_interests");
    expect(destSection?.label).toBe("Destination interests");
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

  it("does not return trip_details after it is confirmed in questionHistory", () => {
    const answers = {
      ...basePersonal,
      preferences: [],
      overnight_preference: "Drive straight through",
    };
    const history = [{
      question: { id: "trip_details", type: "trip_details" },
      answer: { dietary: ["Local food"], trip_budget: "No budget limit" },
    }];
    const next = getNextFlowQuestion(answers, { ...longTripContext, questionHistory: history });
    expect(next.id).not.toBe("trip_details");
  });

  it("does not return fuel_type when answer pruned but question is in history", () => {
    const answers = {
      vehicle: "Car",
      travelers: "2",
      adult_count: 2,
      child_count: 0,
    };
    const history = [{ question: { id: "fuel_type" }, answer: "Gasoline" }];
    const next = getNextFlowQuestion(answers, { ...longTripContext, questionHistory: history });
    expect(next.id).not.toBe("fuel_type");
  });

  it("does not return trip_details for thin transport when in history", () => {
    const answers = {
      vehicle: "Plane",
      travelers: "2",
      adult_count: 2,
      child_count: 0,
    };
    const history = [{ question: { id: "trip_details", type: "trip_details" }, answer: {} }];
    const next = getNextFlowQuestion(answers, { ...longTripContext, questionHistory: history });
    expect(next.id).not.toBe("trip_details");
    expect(next.done).toBe(true);
  });

  it("does not return overnight_preference when pruned but confirmed in history", () => {
    const answers = {
      ...basePersonal,
      preferences: [],
    };
    const history = [
      { question: { id: "overnight_preference" }, answer: OVERNIGHT_PREFERENCE_OVERNIGHT },
    ];
    const next = getNextFlowQuestion(answers, { ...longTripContext, questionHistory: history });
    expect(next.id).not.toBe("overnight_preference");
  });

  it("asks truck lodging with motel tiers before trip_details for no-sleeper routes", () => {
    const answers = {
      vehicle: "Semi Truck (18-wheeler)",
      hauling_type: "General freight",
      sleeper_cab: "No — I need a motel or hotel",
      truck_stop_brand: "Love's",
      route_restrictions: ["No restrictions"],
      overnight_preference: OVERNIGHT_PREFERENCE_OVERNIGHT,
    };
    const next = getNextFlowQuestion(answers, longTripContext);
    expect(next.id).toBe("lodging");
    expect(next.choices).toEqual(TRUCK_LODGING_CHOICES);
    expect(buildTruckLodgingQuestion().ask).toMatch(/motel or hotel/i);
  });

  it("uses motorcycle-specific towing copy on long routes", () => {
    const next = getNextFlowQuestion(
      { vehicle: "Motorcycle", fuel_type: "Gasoline" },
      longTripContext,
    );
    expect(next.id).toBe("towing");
    expect(next.ask).toMatch(/sidecar or cargo trailer/i);
    expect(next.choices).toContain("No, just the bike");
    expect(next.choices).toContain("Yes — sidecar or trailer");
  });

  it("maps user-selected truck lodging and skips auto-assignment", () => {
    const normalized = normalizeTripAnswers({
      vehicle: "Semi Truck (18-wheeler)",
      hauling_type: "General freight",
      sleeper_cab: "No — I need a motel or hotel",
      overnight_preference: OVERNIGHT_PREFERENCE_OVERNIGHT,
      lodging: "Budget motel",
    }, longTripContext);
    expect(normalized.lodging).toBe("Budget motel");
    expect(normalized.lodging_auto_assigned).toBeUndefined();
  });

  it("surfaces assumed truck lodging when tier was auto-assigned", () => {
    const normalized = normalizeTripAnswers({
      vehicle: "Semi Truck (18-wheeler)",
      hauling_type: "General freight",
      sleeper_cab: "No — I need a motel or hotel",
      overnight_preference: OVERNIGHT_PREFERENCE_OVERNIGHT,
    }, longTripContext);
    expect(normalized.lodging).toBe("Mid-range hotel");
    expect(normalized.lodging_auto_assigned).toBe(true);
    const pill = getAssumedTruckLodgingPill(normalized, []);
    expect(pill?.lodging).toBe("Mid-range hotel");
  });

  it("dedupeQuestionHistoryById keeps the latest entry per question id", () => {
    const deduped = dedupeQuestionHistoryById([
      { question: { id: "vehicle" }, answer: "Car" },
      { question: { id: "trip_nights" }, answer: "1 night" },
      { question: { id: "trip_nights" }, answer: "2 nights" },
    ]);
    expect(deduped).toHaveLength(2);
    expect(deduped[1].answer).toBe("2 nights");
  });
});
