import { describe, expect, it } from "vitest";
import { roadStopKey } from "./roadStopKeys.js";

describe("roadStopKey", () => {
  it("prefers stable id fields", () => {
    expect(roadStopKey({ id: "stop-1", title: "Gas" })).toBe("stop-1");
    expect(roadStopKey({ placeId: "ChIJ123", name: "Gas" })).toBe("ChIJ123");
  });

  it("falls back to name and coordinates", () => {
    expect(roadStopKey({ title: "Rest Area", lat: 35.1, lng: -97.2 })).toBe("Rest Area-35.1--97.2");
  });

  it("returns empty string for null stop", () => {
    expect(roadStopKey(null)).toBe("");
  });
});
