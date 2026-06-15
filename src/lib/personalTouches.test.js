import { describe, expect, it } from "vitest";
import {
  getPersonalTouchIconType,
  getPlannedHighlightIconType,
  normalizePersonalTouches,
  buildPlannedHighlights,
  shortenPlannedHighlight,
} from "./personalTouches.js";

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

  it("picks planned highlight icon types", () => {
    expect(getPlannedHighlightIconType("Added diesel fuel stops every 180 miles")).toBe("fuel");
    expect(getPlannedHighlightIconType("Gluten-free dining at lunch stops")).toBe("food");
    expect(getPlannedHighlightIconType("Scenic route based on your past trips")).toBe("route");
  });

  it("shortens highlights to twelve words", () => {
    const long = "We picked scenic overlooks and historic downtown stops along your usual weekend corridor through the mountains.";
    expect(shortenPlannedHighlight(long, 12).split(/\s+/).length).toBeLessThanOrEqual(12);
  });

  it("builds at most three planned highlights", () => {
    const highlights = buildPlannedHighlights([
      "We routed you around toll roads on I-95 for a smoother drive.",
      "Diesel fuel stops every 200 miles based on your truck.",
      "Gluten-free lunch options near your usual meal times.",
      "Generic trip note without much detail.",
    ]);
    expect(highlights.length).toBeLessThanOrEqual(3);
    highlights.forEach(h => {
      expect(h.text.split(/\s+/).length).toBeLessThanOrEqual(12);
      expect(["route", "fuel", "food"]).toContain(h.iconType);
    });
  });
});
