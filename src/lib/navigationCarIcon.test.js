import { describe, expect, it } from "vitest";
import { navigationCarIconUrl } from "./navigationCarIcon.js";

describe("navigationCarIcon", () => {
  it("builds inline SVG data URI with gold fill", () => {
    const url = navigationCarIconUrl();
    expect(url).toMatch(/^data:image\/svg\+xml/);
    expect(decodeURIComponent(url)).toContain("#FFD28C");
    expect(decodeURIComponent(url)).toContain("<svg");
  });
});
