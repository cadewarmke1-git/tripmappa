import { describe, expect, it } from "vitest";
import { paddFromCoords } from "../../server/lib/eiaFuelPrices.js";

describe("paddFromCoords", () => {
  it("maps Texas gulf / east / west corridors", () => {
    expect(paddFromCoords(31.5, -98)).toBe("R30");
    expect(paddFromCoords(41, -88)).toBe("R10");
    expect(paddFromCoords(34, -118)).toBe("R50");
    expect(paddFromCoords(40, -110)).toBe("R40");
  });

  it("falls back to NUS on bad coords", () => {
    expect(paddFromCoords(null, null)).toBe("NUS");
  });
});
