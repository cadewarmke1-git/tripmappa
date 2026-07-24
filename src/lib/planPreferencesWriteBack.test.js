import { describe, expect, it } from "vitest";
import {
  extractWriteBackFields,
  mergePlanPreferencesFromGeneration,
} from "./planPreferencesWriteBack.js";

describe("planPreferencesWriteBack", () => {
  it("extracts core answer fields for write-back", () => {
    const fields = extractWriteBackFields({
      vehicle: "RV",
      fuel_type: "Gasoline",
      travelers: "3 to 5",
      dietary: ["Vegan"],
      accessibility: ["No special needs"],
      schedule_restrictions: ["No restrictions"],
      trip_budget: "Over $1000",
      luxury_level: "4",
      lodging: "Mid-Range",
      preferences: ["Pet friendly", "Scenic route"],
    });
    expect(fields.vehicle).toBe("RV");
    expect(fields.preferences).toEqual(["Pet friendly", "Scenic route"]);
    expect(fields.dietary).toEqual(["Vegan"]);
    expect(fields.luxury_level).toBe("4");
    expect(fields.trip_budget).toBe("Over $1000");
    expect(fields.accessibility).toBeUndefined();
    expect(fields.schedule_restrictions).toBeUndefined();
  });

  it("writes luxury_level like trip_budget", () => {
    const { preferences, meta } = mergePlanPreferencesFromGeneration(
      {},
      { last_generated_preferences: {}, generation_count: 0 },
      { luxury_level: "4", trip_budget: "Over $1000" },
    );
    expect(preferences.luxury_level).toBe("4");
    expect(preferences.trip_budget).toBe("Over $1000");
    expect(meta.last_generated_preferences.luxury_level).toBe("4");
  });

  it("writes empty fields from generation", () => {
    const { preferences } = mergePlanPreferencesFromGeneration(
      {},
      { last_generated_preferences: {}, generation_count: 2 },
      { vehicle: "Car", preferences: ["Pet friendly"] },
    );
    expect(preferences.vehicle).toBe("Car");
    expect(preferences.preferences).toEqual(["Pet friendly"]);
  });

  it("preserves manual profile edit when generation matches last write-back", () => {
    const { preferences } = mergePlanPreferencesFromGeneration(
      { vehicle: "RV" },
      { last_generated_preferences: { vehicle: "Car" }, generation_count: 1 },
      { vehicle: "Car" },
    );
    expect(preferences.vehicle).toBe("RV");
  });

  it("updates when generation value differs from last write-back", () => {
    const { preferences, meta } = mergePlanPreferencesFromGeneration(
      { vehicle: "Car" },
      { last_generated_preferences: { vehicle: "Car" }, generation_count: 4 },
      { vehicle: "RV", preferences: ["Scenic route"] },
    );
    expect(preferences.vehicle).toBe("RV");
    expect(preferences.preferences).toEqual(["Scenic route"]);
    expect(meta.generation_count).toBe(5);
  });

  it("preserves manually set lodging when generation echoes last write-back tier", () => {
    const { preferences } = mergePlanPreferencesFromGeneration(
      { lodging: "Luxury" },
      { last_generated_preferences: { lodging: "Mid-Range" }, generation_count: 3 },
      { lodging: "Mid-Range" },
    );
    expect(preferences.lodging).toBe("Luxury");
  });

  it("writes lodging when profile field is empty", () => {
    const { preferences } = mergePlanPreferencesFromGeneration(
      {},
      { last_generated_preferences: {}, generation_count: 0 },
      { lodging: "Budget" },
    );
    expect(preferences.lodging).toBe("Budget");
  });
});
