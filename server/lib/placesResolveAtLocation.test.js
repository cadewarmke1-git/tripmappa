import { beforeEach, describe, expect, it, vi } from "vitest";

const nearbySearchCached = vi.fn();
const fetchPlaceDetailsCached = vi.fn();
const readOsmPlaceIdMap = vi.fn();
const writeOsmPlaceIdMap = vi.fn();

vi.mock("./placesCorridor.js", () => ({ nearbySearchCached }));
vi.mock("./placesDetailsCache.js", () => ({ fetchPlaceDetailsCached }));
vi.mock("./osmPlaceIdMap.js", () => ({ readOsmPlaceIdMap, writeOsmPlaceIdMap }));
vi.mock("./supabaseAdmin.js", () => ({ getSupabaseAdmin: () => ({ mocked: true }) }));

const { resolvePlaceAtLocation, RESOLVE_RADII_M } = await import("./placesResolveAtLocation.js");

const PLACE = {
  placeId: "ChIJtest123",
  name: "Blue Plate Diner",
  lat: 35.0001,
  lng: -97.0001,
  rating: 4.5,
  photoReference: "photo-ref-abc",
  priceLevel: 2,
  types: ["restaurant"],
  address: "Main St",
};

const DETAILS = {
  placeId: "ChIJtest123",
  name: "Blue Plate Diner",
  rating: 4.5,
  photoReference: "photo-ref-abc",
  priceLevel: 2,
};

describe("resolvePlaceAtLocation", () => {
  beforeEach(() => {
    nearbySearchCached.mockReset();
    fetchPlaceDetailsCached.mockReset();
    readOsmPlaceIdMap.mockReset();
    writeOsmPlaceIdMap.mockReset();
  });

  it("uses tight radii 80/150/300 via nearbySearchCached (not raw)", async () => {
    nearbySearchCached
      .mockResolvedValueOnce({ places: [], cached: false })
      .mockResolvedValueOnce({ places: [], cached: false })
      .mockResolvedValueOnce({ places: [PLACE], cached: false });
    fetchPlaceDetailsCached.mockResolvedValue({ details: DETAILS, cached: false });

    const result = await resolvePlaceAtLocation("key", 35, -97, {
      type: "restaurant",
      keyword: "restaurant",
      osmId: "node/1",
      admin: {},
    });

    expect(RESOLVE_RADII_M).toEqual([80, 150, 300]);
    expect(nearbySearchCached).toHaveBeenCalledTimes(3);
    expect(nearbySearchCached.mock.calls.map((c) => c[2].radius)).toEqual([80, 150, 300]);
    expect(result.nearbyCallsBilled).toBe(3);
    expect(result.details).toEqual(DETAILS);
    expect(writeOsmPlaceIdMap).toHaveBeenCalledWith({}, "node/1", "ChIJtest123");
  });

  it("skips Nearby entirely when placeId is already known", async () => {
    fetchPlaceDetailsCached.mockResolvedValue({ details: DETAILS, cached: true });

    const result = await resolvePlaceAtLocation("key", 35, -97, {
      placeId: "ChIJtest123",
      osmId: "node/known",
      admin: {},
    });

    expect(nearbySearchCached).not.toHaveBeenCalled();
    expect(fetchPlaceDetailsCached).toHaveBeenCalledWith("key", "ChIJtest123", { skipPhotos: false });
    expect(result.nearbyCallsBilled).toBe(0);
    expect(result.nearbyUsed).toBe(false);
    expect(result.details.name).toBe("Blue Plate Diner");
  });

  it("skipPhotos: uses Nearby name/rating without Details or photos", async () => {
    nearbySearchCached.mockResolvedValue({ places: [PLACE], cached: false });

    const result = await resolvePlaceAtLocation("key", 35, -97, {
      type: "restaurant",
      keyword: "restaurant",
      skipPhotos: true,
      osmId: "node/food",
      admin: {},
    });

    expect(fetchPlaceDetailsCached).not.toHaveBeenCalled();
    expect(result.detailsSkipped).toBe(true);
    expect(result.details.name).toBe("Blue Plate Diner");
    expect(result.details.rating).toBe(4.5);
    expect(result.details.photoReference).toBeNull();
    expect(result.nearbyCallsBilled).toBe(1);
    expect(writeOsmPlaceIdMap).toHaveBeenCalledWith({}, "node/food", "ChIJtest123");
    expect(result.detailsSkipped).toBe(true);
  });

  it("bills 0 Nearby when corridor cache hits at each radius until match", async () => {
    nearbySearchCached
      .mockResolvedValueOnce({ places: [], cached: true })
      .mockResolvedValueOnce({ places: [PLACE], cached: true });
    fetchPlaceDetailsCached.mockResolvedValue({ details: DETAILS, cached: true });

    const result = await resolvePlaceAtLocation("key", 35, -97, {
      type: "restaurant",
      keyword: "restaurant",
      admin: {},
    });

    expect(result.nearbyCallsBilled).toBe(0);
    expect(result.nearbyUsed).toBe(true);
    expect(result.details.name).toBe("Blue Plate Diner");
    expect(result.details.rating).toBe(4.5);
    expect(result.details.photoReference).toBe("photo-ref-abc");
  });

  it("skips Nearby entirely on permanent OSM map hit (repeat resolve)", async () => {
    readOsmPlaceIdMap.mockResolvedValue({ osmId: "node/99", placeId: "ChIJtest123" });
    fetchPlaceDetailsCached.mockResolvedValue({ details: DETAILS, cached: true });

    const first = await resolvePlaceAtLocation("key", 35, -97, {
      osmId: "node/99",
      admin: {},
    });
    const second = await resolvePlaceAtLocation("key", 35, -97, {
      osmId: "node/99",
      admin: {},
    });

    expect(nearbySearchCached).not.toHaveBeenCalled();
    expect(first.osmMapHit).toBe(true);
    expect(first.nearbyCallsBilled).toBe(0);
    expect(second.osmMapHit).toBe(true);
    expect(second.nearbyCallsBilled).toBe(0);
    expect(second.details).toEqual(first.details);
  });

  it("repeated corridor: first miss bills Nearby, second map hit bills 0 with identical display fields", async () => {
    const mapStore = new Map();
    readOsmPlaceIdMap.mockImplementation(async (_admin, osmId) => {
      const pid = mapStore.get(osmId);
      return pid ? { osmId, placeId: pid } : null;
    });
    writeOsmPlaceIdMap.mockImplementation(async (_admin, osmId, pid) => {
      mapStore.set(osmId, pid);
    });

    nearbySearchCached.mockResolvedValue({ places: [PLACE], cached: false });
    fetchPlaceDetailsCached.mockResolvedValue({ details: DETAILS, cached: false });

    const pass1 = await resolvePlaceAtLocation("key", 35, -97, {
      type: "restaurant",
      keyword: "restaurant",
      osmId: "node/corridor-a",
      admin: {},
    });

    nearbySearchCached.mockClear();
    fetchPlaceDetailsCached.mockResolvedValue({ details: DETAILS, cached: true });

    const pass2 = await resolvePlaceAtLocation("key", 35, -97, {
      type: "restaurant",
      keyword: "restaurant",
      osmId: "node/corridor-a",
      admin: {},
    });

    expect(pass1.nearbyCallsBilled).toBeGreaterThan(0);
    expect(pass1.osmMapHit).toBe(false);
    expect(pass2.nearbyCallsBilled).toBe(0);
    expect(pass2.osmMapHit).toBe(true);
    expect(nearbySearchCached).not.toHaveBeenCalled();

    for (const field of ["placeId", "name", "rating", "photoReference", "priceLevel"]) {
      expect(pass2.details[field]).toBe(pass1.details[field]);
    }

    const hitRate = 1 - pass2.nearbyCallsBilled / pass1.nearbyCallsBilled;
    expect(hitRate).toBe(1);
  });
});
