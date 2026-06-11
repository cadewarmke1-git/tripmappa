import { describe, expect, it } from "vitest";
import { shouldPreloadGenerationLoader } from "./preloadGenerationLoader.js";

describe("preloadGenerationLoader", () => {
  it("preloads when conversation is complete", () => {
    expect(shouldPreloadGenerationLoader({ convoComplete: true })).toBe(true);
  });

  it("preloads on details-phase questions", () => {
    expect(shouldPreloadGenerationLoader({ currentQuestionId: "trip_details" })).toBe(true);
    expect(shouldPreloadGenerationLoader({ currentQuestionId: "food_allergies" })).toBe(true);
  });

  it("preloads on late route questions", () => {
    expect(shouldPreloadGenerationLoader({ currentQuestionId: "lodging" })).toBe(true);
    expect(shouldPreloadGenerationLoader({ currentQuestionId: "trip_nights" })).toBe(true);
  });

  it("does not preload early in the flow", () => {
    expect(shouldPreloadGenerationLoader({ currentQuestionId: "vehicle" })).toBe(false);
    expect(shouldPreloadGenerationLoader({ currentQuestionId: "travelers" })).toBe(false);
  });
});
