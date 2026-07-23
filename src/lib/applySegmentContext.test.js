import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { applySegmentContextToPlaces } from "./applySegmentContext.js";

describe("applySegmentContextToPlaces", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn(async (url, init) => {
      const u = String(url);
      const body = init?.body ? JSON.parse(init.body) : {};
      if (u.includes("/api/weather")) {
        const weatherByCity = {};
        for (const stop of body.stops || []) {
          weatherByCity[stop.city] = {
            city: stop.city,
            temperatureF: 104,
            condition: "Hot",
            precipitationChance: 5,
            severeWarnings: [{ type: "Excessive Heat Warning", message: "Dangerous heat" }],
          };
        }
        return {
          ok: true,
          json: async () => ({ weatherByCity, severeAlerts: [] }),
        };
      }
      if (u.includes("/api/fuel-stations") && body.mode === "regional-prices") {
        const pricesById = {};
        (body.points || []).forEach((pt, i) => {
          const id = pt.id || `seg-${i}`;
          const regular = i === 0 ? 2.89 : 3.4;
          pricesById[id] = {
            area: "R30",
            region: "gulf",
            regular,
            regularPrice: `$${regular.toFixed(2)}/gal`,
          };
        });
        return {
          ok: true,
          json: async () => ({ pricesById }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("scores pool and emits compressed segment context without mutating cache contract", async () => {
    const placesContext = {
      corridor: [
        {
          lat: 32.8,
          lng: -96.8,
          restaurants: [
            { name: "Desert Overlook Grill", types: ["park"], rating: 4.8 },
            { name: "Adobe Cafe", types: ["restaurant", "cafe"], rating: 4.2 },
          ],
          gasStations: [{ name: "Shell", rating: 4.0 }],
          playgrounds: [{ name: "Riverside Park", types: ["park"], rating: 4.5 }],
        },
        {
          lat: 31.8,
          lng: -106.4,
          restaurants: [{ name: "Indoor Diner", types: ["restaurant"], rating: 4.0 }],
          gasStations: [{ name: "Chevron", rating: 4.1 }],
        },
      ],
      cities: [],
      boundary: { totalMiles: 600, samples: [] },
    };

    const out = await applySegmentContextToPlaces(placesContext, {
      duration: "8 hours 0 mins",
    }, { departureTime: new Date("2026-07-22T08:00:00") });

    expect(out.segmentContextPrompt).toContain("SEGMENT CONTEXT");
    expect(out.segmentContextPrompt).toMatch(/SEG1/);
    expect(out.segmentContexts[0].preferIndoor).toBe(true);
    expect(out.segmentContexts[0].preferFill).toBe(true);
    expect(out.corridor[0].restaurants[0].name).toBe("Adobe Cafe");
    expect(out.corridor[0].restaurants.find(r => /Overlook/i.test(r.name))?.contextNotes).toContain("heat");
    // Original corridor object references are replaced — cache writer never sees tags
    expect(placesContext.corridor[0].restaurants[0].name).toBe("Desert Overlook Grill");
  });

  it("degrades when weather and fuel lookups return empty", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ weatherByCity: {}, severeAlerts: [], pricesById: {} }),
    }));

    const out = await applySegmentContextToPlaces({
      corridor: [{ lat: 30, lng: -97, restaurants: [{ name: "Cafe", types: ["restaurant"] }], gasStations: [] }],
      cities: [],
      boundary: { totalMiles: 50, samples: [] },
    }, { duration: "1 hour" }, { departureTime: new Date() });

    expect(out.corridor[0].restaurants[0].name).toBe("Cafe");
    expect(out.segmentContextPrompt).toContain("SEG1");
  });
});
