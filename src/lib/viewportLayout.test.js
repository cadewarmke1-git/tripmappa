import { describe, expect, it } from "vitest";
import { resolveLayoutFromMatches } from "./viewportLayout.js";

describe("viewportLayout", () => {
  it("uses web layout for wide viewports", () => {
    expect(resolveLayoutFromMatches({ wide: true, finePointer: false })).toBe("web");
  });

  it("uses web layout for desktop pointer even when narrow", () => {
    expect(resolveLayoutFromMatches({ wide: false, finePointer: true })).toBe("web");
  });

  it("uses mobile layout for narrow touch viewports", () => {
    expect(resolveLayoutFromMatches({ wide: false, finePointer: false })).toBe("mobile");
  });
});
