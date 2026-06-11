import { describe, expect, it } from "vitest";
import { buildTruckRoutingPayload } from "./truckRoutingApi.js";

describe("buildTruckRoutingPayload", () => {
  it("includes vehicle dimension and hazmat fields", () => {
    const payload = buildTruckRoutingPayload("Dallas, TX", "Denver, CO", {
      vehicle: "Semi Truck (18-wheeler)",
      truck_height: "13'6\"",
      truck_weight: "80,000 lbs",
      truck_hazmat: "Yes",
    });
    expect(payload.heightFeet).toBeCloseTo(13.5, 1);
    expect(payload.weightLbs).toBe(80000);
    expect(payload.hazmat).toBe(true);
    expect(payload.axleCount).toBe(5);
  });
});
