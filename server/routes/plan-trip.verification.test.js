import { describe, expect, it } from "vitest";
import {
  buildTripContext,
  buildSystemPrompt,
  buildUserPrompt,
  buildJsonSchema,
} from "./plan-trip.js";

const ROUTE = {
  distance: "670 mi",
  duration: "10 hr",
  origin: "Dallas, TX",
  destination: "Nashville, TN",
  citiesAlongRoute: ["Dallas, TX", "Little Rock, AR", "Nashville, TN"],
};

function baseBody(answers, destination = "Nashville, TN") {
  return {
    origin: "Dallas, TX",
    destination,
    answers: { trip_type: "Road trip", ...answers },
    routeInfo: { ...ROUTE, destination },
  };
}

describe("plan-trip verification schema scenarios", () => {
  it("Dallas → Nashville Car Mid-Range Gluten Free includes restaurant verification and mid price_band", () => {
    const ctx = buildTripContext(baseBody({
      vehicle: "Car",
      lodging: "Mid-Range",
      dietary: ["Gluten Free"],
      travelers: "2",
    }));
    const system = buildSystemPrompt(ctx);
    const schema = buildJsonSchema(ctx, false);
    const user = buildUserPrompt(ctx, "VERIFIED PLACES: Local Bistro", false, "Gluten Free required");

    expect(system).toContain("EXACTLY as they appear");
    expect(system).toContain("verified:false");
    expect(system).toContain("verification_note");
    expect(system).toContain("$90–$160/night");
    expect(system).toContain("price_band mid");
    expect(schema).toContain("verification_note");
    expect(schema).toContain("price_band");
    expect(user).toContain("Gluten Free");
    expect(schema).not.toContain("truck_parking");
    expect(system).toContain("PERSONAL_TOUCHES");
    expect(system).toContain("dog-friendly patio");
    expect(schema).toContain("personal_touches");
  });

  it("Dallas → Chicago Truck no sleeper Love's includes truck_parking on restaurants and road_stops", () => {
    const ctx = buildTripContext(baseBody({
      vehicle: "Semi Truck (18-wheeler)",
      lodging: "Sleeper cab — no hotel needed",
      sleeper_cab: "No I need a motel or hotel",
      truck_stop_brand: "Love's",
      hauling_type: "General freight",
    }, "Chicago, IL"));
    const system = buildSystemPrompt(ctx);
    const schema = buildJsonSchema(ctx, false);

    expect(ctx.tripCategory).toBe("commercial");
    expect(system).toContain("TRUCK PARKING");
    expect(system).toContain("truck_parking");
    const user = buildUserPrompt(ctx, "VERIFIED PLACES: Love's Travel Stop", false);
    expect(user).toMatch(/Love/i);
    expect(schema).toContain("truck_parking");
    expect(schema).toContain("verification_note");
  });

  it("Dallas → Asheville family pet friendly Mid-Range includes kid-friendly hotel schema", () => {
    const ctx = buildTripContext(baseBody({
      vehicle: "SUV or Van",
      lodging: "Mid-Range",
      travelers: "3 to 5",
      preferences: ["Pet friendly", "Kid friendly stops"],
      accessibility: ["Traveling with young children"],
      kids_ages: ["5", "8"],
    }, "Asheville, NC"));
    const system = buildSystemPrompt(ctx);
    const schema = buildJsonSchema(ctx, false);

    expect(system).toContain("price_band mid");
    expect(schema).toContain("kidFriendly");
    expect(schema).toContain("price_band");
    expect(buildUserPrompt(ctx, "", false)).toMatch(/young children|family|Pet friendly/i);
  });
});
