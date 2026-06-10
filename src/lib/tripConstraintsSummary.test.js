import { describe, it, expect } from "vitest";
import { buildTripConstraints, formatGenerationHints } from "./tripConstraintsSummary.js";

describe("tripConstraintsSummary", () => {
  it("includes dietary and schedule in constraints", () => {
    const items = buildTripConstraints({
      vehicle: "Car",
      dietary: ["Halal"],
      schedule_restrictions: ["Cannot travel on Saturdays — Sabbath observant"],
      travelers: "2",
    }, { distance: "400 mi", duration: "6 hr" });
    expect(items.some(i => i.id === "dietary")).toBe(true);
    expect(items.some(i => i.id === "schedule")).toBe(true);
  });

  it("includes learned restaurant and fuel brand in constraints", () => {
    const items = buildTripConstraints({
      vehicle: "Semi Truck (18-wheeler)",
      restaurant_preference: "BBQ",
      fuel_brand_preference: "Love's",
    });
    expect(items.some(i => i.id === "restaurant_pref" && i.value === "BBQ")).toBe(true);
    expect(items.some(i => i.id === "fuel_brand" && i.value === "Love's")).toBe(true);
  });

  it("formats generation hints with MUST rules", () => {
    const hints = formatGenerationHints({
      dietary: ["Vegan"],
      accessibility: ["Dialysis centers along route"],
      towing: "Yes — large trailer",
    });
    expect(hints).toContain("MUST");
    expect(hints).toContain("Dialysis");
    expect(hints).toContain("trailer");
  });

  it("includes default-confirmed signals and coordination block", () => {
    const hints = formatGenerationHints({
      vehicle: "Multi-Vehicle Trip",
      coordination_needs: ["Stay together the whole way"],
      trip_details_defaults_confirmed: true,
      dietary: [],
      accessibility: [],
      schedule_restrictions: [],
      trip_budget: "No budget limit",
      kids_ages: ["Toddlers (2-4)"],
    });
    expect(hints.indexOf("MULTI-VEHICLE COORDINATION")).toBeLessThan(hints.indexOf("USER CONSTRAINTS"));
    expect(hints).toContain("User confirmed no dietary restrictions");
    expect(hints).toContain("Toddlers (2-4)");
  });

  it("places regenerate diff block above coordination on regenerate", () => {
    const hints = formatGenerationHints(
      { vehicle: "RV", dietary: ["Halal"] },
      null,
      { regenerateDiffBlock: "USER EDITED SINCE LAST GENERATION:\n- Vehicle changed from Car to RV\n- Halal dietary restriction added" },
    );
    expect(hints.indexOf("USER EDITED SINCE LAST GENERATION")).toBeLessThan(hints.indexOf("USER CONSTRAINTS"));
    expect(hints).toContain("Halal dietary restriction added");
  });

  it("signals kids ages skipped for conservative defaults", () => {
    const hints = formatGenerationHints({
      kids_ages: ["Not sure / prefer not to say"],
      accessibility: ["Traveling with young children"],
    });
    expect(hints).toContain("ages not specified");
    expect(hints).toContain("conservative family-friendly defaults");
  });

  it("includes truck context block with hauling, sleeper, stops, and HOS", () => {
    const hints = formatGenerationHints({
      vehicle: "Semi Truck (18-wheeler)",
      hauling_type: "Refrigerated load",
      sleeper_cab: "No I need a motel or hotel",
      lodging: "Mid-Range",
      truck_stop_brand: "Love's",
      route_restrictions: ["Avoid toll roads"],
      hos_compliance: true,
      dietary: [],
      accessibility: [],
      schedule_restrictions: [],
      trip_budget: "No budget limit",
      stops_interests: [],
    });
    expect(hints).toContain("=== TRUCK CONTEXT ===");
    expect(hints).toContain("Hauling type: Refrigerated load");
    expect(hints).toContain("Sleeper cab: No I need a motel or hotel");
    expect(hints).toContain("External lodging tier (no sleeper): Mid-Range");
    expect(hints).toContain("Preferred truck stop brand: Love's");
    expect(hints).toContain("Route restrictions: Avoid toll roads");
    expect(hints).toContain("HOS compliance");
  });

  it("uses travel wording for plane schedule in hints", () => {
    const hints = formatGenerationHints({
      vehicle: "Plane",
      schedule_restrictions: ["Travel only during specific hours — I will specify"],
      schedule_drive_hours: "weekdays 8 AM to 6 PM",
      dietary: [],
      accessibility: [],
      trip_budget: "No budget limit",
      stops_interests: [],
    });
    expect(hints).not.toMatch(/Drive only/i);
    expect(hints).toContain("Travel only during specific hours");
    expect(hints).toContain("preferred travel hours");
  });

  it("includes travelers, party split, kids ages, nights, and pet constraint", () => {
    const hints = formatGenerationHints({
      vehicle: "Car",
      travelers: "3 to 5",
      adult_count: 2,
      child_count: 2,
      kids_ages: ["Toddlers (2-4)", "Young children (5-10)"],
      trip_nights: "2 nights",
      preferences: ["Pet friendly", "Scenic route"],
      dietary: [],
      accessibility: [],
      schedule_restrictions: [],
      trip_budget: "No budget limit",
      stops_interests: [],
    });
    expect(hints).toContain("Travelers: 3 to 5 (2 adults, 2 children)");
    expect(hints).toContain("including children ages: Toddlers (2-4), Young children (5-10)");
    expect(hints).toContain("Planned overnight stops: 2 nights");
    expect(hints).toContain("Traveling with a pet — all stop and lodging recommendations must be pet-friendly");
  });

  it("uses Destination interests label for plane hints", () => {
    const hints = formatGenerationHints({
      vehicle: "Plane",
      dietary: [],
      accessibility: [],
      schedule_restrictions: [],
      trip_budget: "No budget limit",
      stops_interests: ["Food and dining", "music_nightlife"],
    });
    expect(hints).toContain("Destination interests: Food and dining, Music and nightlife");
    expect(hints).not.toContain("Fun stops:");
  });

  it("keeps Fun stops label for car hints", () => {
    const hints = formatGenerationHints({
      vehicle: "Car",
      dietary: [],
      accessibility: [],
      schedule_restrictions: [],
      trip_budget: "No budget limit",
      stops_interests: ["National Parks or Nature"],
    });
    expect(hints).toContain("Fun stops: National Parks or Nature");
  });

  it("emits empty schedule as no-restriction signal", () => {
    const hints = formatGenerationHints({
      vehicle: "Car",
      dietary: [],
      accessibility: [],
      schedule_restrictions: [],
      trip_budget: "No budget limit",
      stops_interests: [],
    });
    expect(hints).toContain("Schedule: No restrictions — travel any time");
  });

  it("includes inferred restaurant stop-add hint as soft generation context", () => {
    const hints = formatGenerationHints({
      vehicle: "Car",
      inferredRestaurantHint: "User frequently adds BBQ stops on past trips.",
    });
    expect(hints).toContain("User frequently adds BBQ stops on past trips.");
    expect(hints).not.toContain("Learned restaurant style");
  });

  it("emits flexible schedule signal when No restrictions selected", () => {
    const hints = formatGenerationHints({
      vehicle: "Car",
      dietary: [],
      accessibility: [],
      schedule_restrictions: ["No restrictions"],
      trip_budget: "No budget limit",
      stops_interests: [],
    });
    expect(hints).toContain("Schedule: Fully flexible — no time restrictions on driving or stops");
  });

  it("includes collaboration hints block in generation hints", () => {
    const hints = formatGenerationHints(
      { vehicle: "Car", dietary: [] },
      null,
      { collaborationHintsBlock: "=== GROUP COLLABORATION INPUT ===\n- Amy: diet: Vegan" },
    );
    expect(hints).toContain("GROUP COLLABORATION INPUT");
    expect(hints).toContain("Amy: diet: Vegan");
  });
});
