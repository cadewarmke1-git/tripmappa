import { describe, expect, it } from "vitest";
import {
  buildRecentTripsContext,
  buildFlowPrefillFromPreferences,
  formatGracefulDegradationNotes,
  mergeDisplayAnswers,
  isQuestionConfirmedInHistory,
  stripUnconfirmedPrefillFromAnswers,
  planPreferencesToFlowPrefill,
  resolveAnswersWithFallback,
  stripAnswersForSonnet,
} from "./generationContext.js";
import {
  buildRecentTripsPreferencesRollup,
  buildUserPatternSummary,
  resolveTripsForContext,
} from "./tripHistoryAnalysis.js";

function makeTrip(answers, overrides = {}) {
  return {
    origin: "Austin, TX",
    dest: "Dallas, TX",
    answers,
    roadStops: [],
    ...overrides,
  };
}

describe("generationContext flow prefill", () => {
  it("maps saved plan preferences to flow prefill without route-specific fields", () => {
    const prefill = planPreferencesToFlowPrefill({
      vehicle: "SUV",
      fuel_type: "Hybrid",
      travelers: "3 to 5",
      dietary: ["Halal"],
      accessibility: ["Wheelchair accessible stops"],
      lodging: "Luxury",
      trip_budget: "$500 to $1000",
      preferences: ["Pet friendly", "Scenic route"],
    });
    expect(prefill.vehicle).toBe("SUV or Van");
    expect(prefill.fuel_type).toBe("Hybrid");
    expect(prefill.travelers).toBe("3 to 5");
    expect(prefill.dietary).toEqual(["Halal"]);
    expect(prefill.lodging).toBeUndefined();
    expect(prefill.preferences).toEqual(["Pet friendly", "Scenic route"]);
  });

  it("maps luxury_level from plan preferences like trip_budget", () => {
    const prefill = planPreferencesToFlowPrefill({
      luxury_level: "4",
      trip_budget: "Over $1000",
      dietary: ["Vegan"],
    });
    expect(prefill.luxury_level).toBe("4");
    expect(prefill.trip_budget).toBe("Over $1000");
    expect(prefill.dietary).toEqual(["Vegan"]);
  });

  it("isQuestionConfirmedInHistory tracks confirmed question ids", () => {
    expect(isQuestionConfirmedInHistory("fuel_type", [])).toBe(false);
    expect(isQuestionConfirmedInHistory("fuel_type", [{ question: { id: "vehicle" } }])).toBe(false);
    expect(isQuestionConfirmedInHistory("fuel_type", [{ question: { id: "fuel_type" } }])).toBe(true);
  });

  it("stripUnconfirmedPrefillFromAnswers keeps trip_details sub-fields after trip_details is confirmed", () => {
    const prefill = { dietary: ["Vegan"], trip_budget: "No budget limit" };
    const kept = stripUnconfirmedPrefillFromAnswers(
      {
        vehicle: "Car",
        dietary: ["Vegan"],
        stops_interests: [],
        accessibility: [],
        schedule_restrictions: [],
        trip_budget: "No budget limit",
      },
      prefill,
      [{ question: { id: "trip_details" }, answer: { dietary: ["Vegan"], trip_budget: "No budget limit" } }],
    );
    expect(kept.dietary).toEqual(["Vegan"]);
    expect(kept.trip_budget).toBe("No budget limit");
  });

  it("stripUnconfirmedPrefillFromAnswers removes leaked prefill-only answer fields", () => {
    const prefill = { fuel_type: "Electric — Tesla Superchargers", dietary: ["Vegan"] };
    const stripped = stripUnconfirmedPrefillFromAnswers(
      { vehicle: "Car", fuel_type: "Electric — Tesla Superchargers", dietary: ["Vegan"] },
      prefill,
      [{ question: { id: "vehicle" }, answer: "Car" }],
    );
    expect(stripped).toEqual({ vehicle: "Car" });
    const kept = stripUnconfirmedPrefillFromAnswers(
      { vehicle: "Car", fuel_type: "Gasoline" },
      prefill,
      [{ question: { id: "vehicle" }, answer: "Car" }],
    );
    expect(kept.fuel_type).toBe("Gasoline");
  });

  it("mergeDisplayAnswers does not apply saved prefill to the question UI", () => {
    const prefill = { vehicle: "Car", fuel_type: "Gasoline", preferences: ["Pet friendly"], dietary: ["Vegan"] };
    const merged = mergeDisplayAnswers({}, prefill, []);
    expect(merged).toEqual({});
    const withAnswers = mergeDisplayAnswers({ vehicle: "RV", preferences: ["Scenic route"] }, prefill, []);
    expect(withAnswers).toEqual({ vehicle: "RV", preferences: ["Scenic route"] });
  });

  it("resolveAnswersWithFallback merges plan prefs at generation time", () => {
    const merged = resolveAnswersWithFallback(
      { vehicle: "Car" },
      null,
      { planPrefs: { dietary: ["Halal"], travelers: "2" } },
    );
    expect(merged.dietary).toEqual(["Halal"]);
    expect(merged.travelers).toBe("2");
  });

  it("resolveAnswersWithFallback applies plan luxury_level when answers omit it", () => {
    const merged = resolveAnswersWithFallback(
      { vehicle: "Car", _smartDefaultsApplied: true },
      null,
      { planPrefs: { luxury_level: "4", trip_budget: "Over $1000", dietary: ["Vegan"] } },
    );
    expect(merged.luxury_level).toBe("4");
    expect(merged.dietary).toEqual(["Vegan"]);
    expect(merged.trip_budget).toBe("Over $1000");
  });

  it("buildFlowPrefillFromPreferences prefers explicit plan prefs over trip learning", () => {
    const prefill = buildFlowPrefillFromPreferences(
      { dietary: ["Halal"], travelers: "2" },
      { stop_categories: { fuel: 5 } },
    );
    expect(prefill.dietary).toEqual(["Halal"]);
    expect(prefill.travelers).toBe("2");
  });
});

describe("recent trip history context", () => {
  it("includes expanded constraint fields per trip", () => {
    const context = buildRecentTripsContext([
      makeTrip({
        vehicle: "RV",
        fuel_type: "Diesel",
        travelers: "3 to 5",
        adult_count: 2,
        child_count: 1,
        dietary: ["Vegan"],
        accessibility: ["Wheelchair accessible stops"],
        schedule_restrictions: ["Cannot travel on Sundays"],
        trip_budget: "$500 to $1000",
        lodging: "Mid-Range",
        trip_nights: "2 nights",
        preferences: ["Pet friendly", "Scenic route"],
        stops_interests: ["Local food"],
      }),
    ], 1);
    expect(context).toContain("Diet: Vegan");
    expect(context).toContain("Budget: $500 to $1000");
    expect(context).toContain("Pet: traveling with pet");
    expect(context).toContain("Route prefs: Pet friendly, Scenic route");
    expect(context).toContain("fuel Diesel");
  });

  it("detects cross-trip patterns with confidence thresholds", () => {
    const trips = Array.from({ length: 5 }, () => makeTrip({
      vehicle: "RV",
      lodging: "Mid-Range",
      trip_budget: "$500 to $1000",
      dietary: ["Vegan"],
      preferences: ["Scenic route", "Pet friendly"],
      schedule_restrictions: ["Cannot travel on Sundays"],
    }));
    const patterns = buildUserPatternSummary(trips);
    expect(patterns).toContain("USER TRAVEL PATTERNS");
    expect(patterns).toContain("Always prefers scenic routes");
    expect(patterns).toContain("Consistently travels pet-friendly");
    expect(patterns).toContain("Consistent vehicle type: RV");
    expect(patterns).toContain("Current trip answers take priority over these patterns where they differ.");
  });

  it("requires 3 of 5 scenic trips to trigger scenic pattern", () => {
    const scenicTrip = () => makeTrip({ preferences: ["Scenic route"] });
    const plainTrip = () => makeTrip({ preferences: [] });
    const threeScenic = [
      scenicTrip(), scenicTrip(), scenicTrip(), plainTrip(), plainTrip(),
    ];
    expect(buildUserPatternSummary(threeScenic)).toContain("prefers scenic routes");

    const twoScenic = [
      scenicTrip(), scenicTrip(), plainTrip(), plainTrip(), plainTrip(),
    ];
    expect(buildUserPatternSummary(twoScenic)).toBe("");
  });

  it("detects dietary pattern at 3 of 5 trips (health/safety threshold)", () => {
    const gfTrip = () => makeTrip({ dietary: ["Gluten Free"] });
    const plainTrip = () => makeTrip({ dietary: [] });
    const threeGf = [
      gfTrip(), gfTrip(), gfTrip(), plainTrip(), plainTrip(),
    ];
    expect(buildUserPatternSummary(threeGf)).toContain("Consistent dietary restriction: Gluten Free");

    const twoGf = [
      gfTrip(), gfTrip(), plainTrip(), plainTrip(), plainTrip(),
    ];
    expect(buildUserPatternSummary(twoGf)).not.toContain("Consistent dietary restriction");
  });

  it("returns no patterns for empty trip history", () => {
    expect(buildUserPatternSummary([])).toBe("");
  });

  it("reads trips from a ref for back-to-back generation context", () => {
    const trip = makeTrip({ vehicle: "Car", preferences: ["Pet friendly"] });
    const ref = { current: [trip] };
    expect(resolveTripsForContext(ref)).toHaveLength(1);
    expect(buildRecentTripsContext(ref, 1)).toContain("Pet friendly");
  });

  it("adds thin-history note when saved trip count is below 3", () => {
    const notes = formatGracefulDegradationNotes({}, null, [], 1);
    expect(notes).toContain("No trip history yet — do not infer travel patterns from stop-category data alone.");
  });

  it("builds preferences rollup for server prompt", () => {
    const rollup = buildRecentTripsPreferencesRollup([
      makeTrip({ preferences: ["Pet friendly"], trip_budget: "$500 to $1000", lodging: "Mid-Range", dietary: ["Vegan"] }),
      makeTrip({ preferences: ["Pet friendly"], trip_budget: "$500 to $1000", lodging: "Mid-Range", dietary: ["Vegan"] }),
    ], 2);
    expect(rollup).toContain("Pet-friendly trips: 2 of last 2");
    expect(rollup).toContain("Typical budget tier");
  });

  it("surfaces dominant stop-add restaurant learning as a generation hint at 3+ stops", () => {
    const merged = resolveAnswersWithFallback(
      { vehicle: "Semi Truck (18-wheeler)" },
      { restaurant_types: { BBQ: 4 }, fuel_brands: { "Love's": 5 }, trip_count: 4 },
    );
    expect(merged.inferredRestaurantHint).toBe("User frequently adds BBQ stops on past trips.");
    expect(merged.restaurant_preference).toBeUndefined();
    expect(merged.truck_stop_brand).toBe("Love's");
    expect(merged.fuel_brand_preference).toBe("Love's");
  });

  it("still merges weak restaurant signal when stop count is below threshold", () => {
    const merged = resolveAnswersWithFallback(
      { vehicle: "Car" },
      { restaurant_types: { BBQ: 2 } },
    );
    expect(merged.restaurant_preference).toBe("BBQ");
    expect(merged.inferredRestaurantHint).toBeUndefined();
  });

  it("does not infer restaurant hint when user set restaurant_preference in plan prefs", () => {
    const merged = resolveAnswersWithFallback(
      {},
      { restaurant_types: { BBQ: 5 } },
      { planPrefs: { restaurant_preference: "Steakhouse" } },
    );
    expect(merged.inferredRestaurantHint).toBeUndefined();
  });

  it("does not override explicit dietary or truck stop brand answers", () => {
    const merged = resolveAnswersWithFallback(
      {
        vehicle: "Semi Truck (18-wheeler)",
        dietary: ["Halal"],
        truck_stop_brand: "Pilot Flying J",
      },
      {
        restaurant_types: { BBQ: 4 },
        fuel_brands: { "Love's": 5 },
      },
    );
    expect(merged.restaurant_preference).toBeUndefined();
    expect(merged.truck_stop_brand).toBe("Pilot Flying J");
  });

  it("does not merge learned restaurant_preference when dietary restriction is set", () => {
    const merged = resolveAnswersWithFallback(
      { vehicle: "Car", dietary: ["Gluten Free"] },
      { restaurant_types: { BBQ: 5 }, trip_count: 5 },
    );
    expect(merged.restaurant_preference).toBeUndefined();
    expect(merged.inferredRestaurantHint).toBeUndefined();
  });

  it("stripAnswersForSonnet removes restaurant_preference when dietary is present", () => {
    const out = stripAnswersForSonnet({
      dietary: ["Gluten Free"],
      restaurant_preference: "BBQ",
    });
    expect(out.restaurant_preference).toBeUndefined();
  });
});
