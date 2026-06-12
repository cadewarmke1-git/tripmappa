import { describe, expect, it } from "vitest";
import {
  inferRoadStopCategory,
  isEvChargingStop,
  isPlausibleEvChargingStation,
} from "./roadStopCategory.js";

describe("roadStopCategory", () => {
  it("labels Electrify America as Charging", () => {
    expect(inferRoadStopCategory({ name: "Electrify America", category: "rest" })).toBe("Charging");
  });

  it("rejects Subway restaurant as EV station", () => {
    expect(isPlausibleEvChargingStation({
      name: "Subway",
      address: "123 Main St",
      types: ["restaurant", "food"],
    })).toBe(false);
  });

  it("accepts charging station with EV place type", () => {
    expect(isPlausibleEvChargingStation({
      name: "Electrify America",
      address: "500 Commerce Dr, Dallas, TX",
      types: ["electric_vehicle_charging_station"],
      network: "Electrify America",
      chargerTypes: ["DC Fast Charge"],
    })).toBe(true);
  });

  it("detects charging from NREL metadata", () => {
    expect(isEvChargingStop({
      name: "Route 66 Stop",
      chargerTypes: ["DC Fast Charge"],
      chargeTime80: "~30 min",
    })).toBe(true);
  });
});
