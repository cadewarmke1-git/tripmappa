/** Permanent OSM id → Google place_id map (no TTL — place_id storage is ToS-allowed). */

import { getSupabaseAdmin } from "./supabaseAdmin.js";

export function normalizeOsmId(osmId) {
  if (osmId == null) return null;
  const s = String(osmId).trim();
  return s || null;
}

export async function readOsmPlaceIdMap(admin, osmId) {
  const id = normalizeOsmId(osmId);
  if (!admin || !id) return null;
  try {
    const { data, error } = await admin
      .from("osm_place_id_map")
      .select("osm_id, place_id")
      .eq("osm_id", id)
      .maybeSingle();
    if (error) {
      console.warn("osm_place_id_map read:", error.message);
      return null;
    }
    if (!data?.place_id) return null;
    return { osmId: data.osm_id, placeId: data.place_id };
  } catch (err) {
    console.warn("osm_place_id_map read failed:", err.message);
    return null;
  }
}

export async function writeOsmPlaceIdMap(admin, osmId, placeId) {
  const id = normalizeOsmId(osmId);
  const pid = placeId != null ? String(placeId).trim() : "";
  if (!admin || !id || !pid) return;
  try {
    const { error } = await admin.from("osm_place_id_map").upsert(
      {
        osm_id: id,
        place_id: pid,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "osm_id" },
    );
    if (error) console.warn("osm_place_id_map write:", error.message);
  } catch (err) {
    console.warn("osm_place_id_map write failed:", err.message);
  }
}

/** Convenience when caller has no admin handle yet. */
export async function lookupOsmPlaceId(osmId) {
  return readOsmPlaceIdMap(getSupabaseAdmin(), osmId);
}
