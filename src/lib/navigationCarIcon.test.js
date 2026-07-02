import { describe, expect, it } from "vitest";
import { CAR_MARKER_PATH, getBearing } from "./navigationCarIcon.js";

describe("navigationCarIcon", () => {
  it("uses vintage car PNG asset path", () => {
    expect(CAR_MARKER_PATH).toBe("/markers/vintage-car.png");
  });

  it("getBearing returns east for due-east segment", () => {
    const bearing = getBearing(
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 },
    );
    expect(bearing).toBeCloseTo(90, 0);
  });

  it("getBearing returns north for due-north segment", () => {
    const bearing = getBearing(
      { lat: 0, lng: 0 },
      { lat: 1, lng: 0 },
    );
    expect(bearing).toBeCloseTo(0, 0);
  });
});
