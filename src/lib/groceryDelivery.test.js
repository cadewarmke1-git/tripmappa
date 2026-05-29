import { describe, expect, it } from "vitest";
import {
  buildTripReferenceId,
  citiesMatch,
  computeDestinationArrival,
  defaultScheduledDeliveryTime,
  formatDatetimeLocalValue,
  resolveGroceryDestination,
  splitSpokenGroceryItems,
} from "./groceryDelivery.js";

describe("groceryDelivery", () => {
  it("matches cities by primary label", () => {
    expect(citiesMatch("Chicago, IL", "Chicago, USA")).toBe(true);
    expect(citiesMatch("Denver, CO", "Boulder, CO")).toBe(false);
  });

  it("resolves destination from hotel and dest", () => {
    const dest = resolveGroceryDestination({
      dest: "Austin, TX",
      selectedLodging: [{ id: "1", name: "Lone Star Hotel", neighborhood: "Downtown" }],
      stops: [{ city: "Austin, TX", lat: 30.27, lng: -97.74 }],
    });
    expect(dest.hotelName).toBe("Lone Star Hotel");
    expect(dest.displayAddress).toContain("Lone Star Hotel");
    expect(dest.instacartAddress.city).toBe("Austin");
  });

  it("computes arrival and default delivery one hour earlier", () => {
    const dep = new Date("2026-05-23T10:00:00");
    const arrival = computeDestinationArrival({
      departureTime: dep,
      routeInfo: { duration: "5 hours 30 mins" },
    });
    expect(arrival.getHours()).toBe(15);
    expect(arrival.getMinutes()).toBe(30);

    const scheduled = defaultScheduledDeliveryTime(arrival);
    expect(scheduled.getHours()).toBe(14);
    expect(scheduled.getMinutes()).toBe(30);
  });

  it("formats datetime-local values", () => {
    const d = new Date("2026-05-23T14:05:00");
    expect(formatDatetimeLocalValue(d)).toBe("2026-05-23T14:05");
  });

  it("splits spoken grocery phrases", () => {
    expect(splitSpokenGroceryItems("milk, eggs and bread")).toEqual(["milk", "eggs", "bread"]);
  });

  it("builds stable trip reference ids", () => {
    const a = buildTripReferenceId({ origin: "A", dest: "B", departureTime: new Date("2026-01-01") });
    const b = buildTripReferenceId({ origin: "A", dest: "B", departureTime: new Date("2026-01-01") });
    expect(a).toBe(b);
    expect(a.startsWith("trip-")).toBe(true);
  });
});
