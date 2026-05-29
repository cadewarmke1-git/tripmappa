import { describe, expect, it } from "vitest";
import { roadStopKey, roadStopExistsInList, normalizeRoadStopEntry } from "./roadStopKeys.js";

describe("roadStopKey", () => {
  it("prefers stable id fields", () => {
    expect(roadStopKey({ id: "stop-1", title: "Gas", lat: 35.1, lng: -97.2 })).toBe("geo:gas:35.100:-97.200");
    expect(roadStopKey({ placeId: "ChIJ123", name: "Gas" })).toBe("place_id:ChIJ123");
  });

  it("falls back to name and coordinates", () => {
    expect(roadStopKey({ title: "Rest Area", lat: 35.1, lng: -97.2 })).toBe("geo:rest area:35.100:-97.200");
  });

  it("returns empty string for null stop", () => {
    expect(roadStopKey(null)).toBe("");
  });

  it("detects duplicates in trip list", () => {
    const card = {
      id: "ChIJ123",
      placeId: "ChIJ123",
      title: "Pilot",
      stopData: { placeId: "ChIJ123", name: "Pilot", lat: 35.1, lng: -97.2 },
    };
    const existing = [{ placeId: "ChIJ123", name: "Pilot", lat: 35.1, lng: -97.2 }];
    expect(roadStopExistsInList(existing, card)).toBe(true);
    expect(roadStopExistsInList(existing, normalizeRoadStopEntry(card))).toBe(true);
  });
});
