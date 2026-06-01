import { describe, expect, it } from "vitest";
import { resolveApiRoute } from "./resolveApiRoute.js";

describe("resolveApiRoute", () => {
  it("reads route from query.path string or array", () => {
    expect(resolveApiRoute({ query: { path: "plan-trip" }, url: "/api/router?path=plan-trip" }))
      .toBe("plan-trip");
    expect(resolveApiRoute({ query: { path: ["grocery", "order"] }, url: "/api/router" }))
      .toBe("grocery/order");
  });

  it("falls back to parsing /api/* from the request URL", () => {
    expect(resolveApiRoute({ query: {}, url: "/api/plan-trip" })).toBe("plan-trip");
    expect(resolveApiRoute({ query: {}, url: "/api/grocery/order" })).toBe("grocery/order");
  });

  it("ignores bare /api/router without a path param", () => {
    expect(resolveApiRoute({ query: {}, url: "/api/router" })).toBe("");
  });
});
