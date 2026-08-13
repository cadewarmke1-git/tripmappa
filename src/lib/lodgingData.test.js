import { describe, expect, it } from "vitest";
import {
  getRvParksForStop,
  getTruckStopsForStop,
  getRestAreasForStop,
} from "./lodgingData.js";

describe("lodgingData empty fallbacks", () => {
  it("returns [] for RV parks instead of static PLACEHOLDER data", () => {
    expect(getRvParksForStop("Amarillo, TX")).toEqual([]);
  });

  it("returns [] for truck stops instead of static PLACEHOLDER data", () => {
    expect(getTruckStopsForStop("Amarillo, TX", { truck_stop_brand: "Love's" })).toEqual([]);
  });

  it("returns [] for rest areas instead of static PLACEHOLDER data", () => {
    expect(getRestAreasForStop("Amarillo, TX")).toEqual([]);
  });
});
