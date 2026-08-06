import { describe, expect, it, vi } from "vitest";
import {
  roadStopGeocodeQueries,
  routeFallbackForRoadStop,
  ensureRoadStopCoordinates,
} from "./roadStopCoordinates.js";

describe("roadStopGeocodeQueries", () => {
  it("prefers name + location", () => {
    expect(roadStopGeocodeQueries({
      name: "Exxon — Amarillo, TX",
      location: "Amarillo, TX",
    })[0]).toContain("Exxon");
  });

  it("falls back to location alone", () => {
    expect(roadStopGeocodeQueries({ location: "Childress, TX" })).toEqual(["Childress, TX"]);
  });
});

describe("routeFallbackForRoadStop", () => {
  const routePoints = [
    { lat: 32.78, lng: -96.8 },
    { lat: 34.0, lng: -100.0 },
    { lat: 35.2, lng: -101.8 },
    { lat: 39.74, lng: -104.99 },
  ];

  it("places stop near claimed mile fraction along the polyline", () => {
    const hit = routeFallbackForRoadStop(
      { distance: "400 mi" },
      routePoints,
      800,
    );
    expect(hit.source).toBe("route_fallback");
    // 400/800 = 0.5 → index 2 of 0..3? round(0.5*3)=2
    expect(hit.lat).toBe(35.2);
    expect(hit.lng).toBe(-101.8);
  });
});

describe("ensureRoadStopCoordinates", () => {
  const routePoints = [
    { lat: 32.78, lng: -96.8 },
    { lat: 35.2, lng: -101.8 },
    { lat: 39.74, lng: -104.99 },
  ];

  it("keeps existing coords", async () => {
    const out = await ensureRoadStopCoordinates([
      { name: "Already pinned", lat: 1, lng: 2 },
    ], { routePoints });
    expect(out[0]).toMatchObject({ lat: 1, lng: 2, coordSource: "existing" });
  });

  it("geocodes LLM stops missing coords", async () => {
    const geocode = vi.fn(async () => ({ lat: 34.42, lng: -100.2, formatted: "Childress, TX" }));
    const out = await ensureRoadStopCoordinates([
      { name: "TA Travel Center", location: "Childress, TX", distance: "225 mi", fromLlm: true },
      { name: "Exxon", location: "Amarillo, TX", distance: "430 mi", fromLlm: true },
      { name: "Pilot", location: "Raton, NM", distance: "565 mi", fromLlm: true },
    ], { routePoints, totalMiles: 793, geocode });

    expect(out).toHaveLength(3);
    expect(out.every((s) => s.lat != null && s.lng != null)).toBe(true);
    expect(out.every((s) => s.coordSource === "geocode")).toBe(true);
    expect(geocode).toHaveBeenCalled();
  });

  it("uses visible route fallback when geocode fails", async () => {
    const geocode = vi.fn(async () => null);
    const out = await ensureRoadStopCoordinates([
      { name: "Mystery Stop", location: "Nowhere, XX", distance: "400 mi", fromLlm: true },
    ], { routePoints, totalMiles: 800, geocode });

    expect(out[0].lat).toBeTruthy();
    expect(out[0].lng).toBeTruthy();
    expect(out[0].coordSource).toBe("route_fallback");
    expect(out[0].coordApprox).toBe(true);
  });
});
