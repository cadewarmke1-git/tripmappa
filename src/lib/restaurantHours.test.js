import { describe, expect, it } from "vitest";
import { filterDinnerRestaurants, dinnerOpenStatus, isOpenOrOpeningWithinTwoHours } from "./restaurantHours.js";

describe("restaurantHours", () => {
  const arrival = new Date("2026-06-15T18:30:00");

  it("prefers open restaurants over closed", () => {
    const filtered = filterDinnerRestaurants([
      { placeId: "a", name: "Closed Spot", openNow: false, hours: "Monday: Closed" },
      { placeId: "b", name: "Open Spot", openNow: true, rating: 4.5 },
    ], arrival);
    expect(filtered[0].placeId).toBe("b");
  });

  it("includes restaurants opening within two hours", () => {
    const arrival = new Date("2026-06-15T16:00:00");
    expect(isOpenOrOpeningWithinTwoHours({ openNow: true }, arrival)).toBe(true);
    expect(isOpenOrOpeningWithinTwoHours({
      openNow: false,
      hours: "Monday: 5:00 PM – 10:00 PM",
    }, arrival)).toBe(true);
    expect(isOpenOrOpeningWithinTwoHours({
      openNow: false,
      hours: "Monday: Closed",
    }, arrival)).toBe(false);
  });

  it("shows opens-later label instead of closed for evening openings", () => {
    const status = dinnerOpenStatus({
      openNow: false,
      hours: "Monday: 5:00 PM – 10:00 PM",
    }, new Date("2026-06-15T16:00:00"));
    expect(status.kind).toBe("opens_later");
    expect(status.label).toMatch(/Opens/i);
  });
});
