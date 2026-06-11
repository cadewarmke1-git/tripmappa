import { describe, expect, it } from "vitest";
import { getPersonalTouchIconType, normalizePersonalTouches } from "./personalTouches.js";

describe("personalTouches", () => {
  it("picks icon types by touch topic", () => {
    expect(getPersonalTouchIconType("Added a dog-friendly patio at lunch")).toBe("pet");
    expect(getPersonalTouchIconType("Playground breaks for young children")).toBe("family");
    expect(getPersonalTouchIconType("Gluten-free dining at every stop")).toBe("dietary");
    expect(getPersonalTouchIconType("Scenic route based on your past trips")).toBe("preference");
    expect(getPersonalTouchIconType("Custom routing note")).toBe("default");
  });

  it("normalizes and caps touches", () => {
    expect(normalizePersonalTouches(["  One  ", "", "Two", "Three", "Four", "Five"])).toEqual([
      "One", "Two", "Three", "Four",
    ]);
  });
});
