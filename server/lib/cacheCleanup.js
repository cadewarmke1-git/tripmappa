/** Weekly purge of expired rows from Supabase cache tables (TTL matches read-side logic). */

import { getSupabaseAdmin } from "./supabaseAdmin.js";
import { cacheExpiresBefore as restStopExpiresBefore } from "./restStopOsm.js";
import { cacheExpiresBefore as placesCorridorExpiresBefore } from "./placesCorridor.js";
import { cacheExpiresBefore as osmCorridorExpiresBefore } from "./corridorOsm.js";
import { cacheExpiresBefore as placeDetailsExpiresBefore } from "./placesDetailsCache.js";
import { cacheExpiresBefore as geocodeExpiresBefore } from "./geocodeCache.js";

const CACHE_TABLES = [
  { table: "rest_stop_cache", expiresBefore: restStopExpiresBefore },
  { table: "places_corridor_cache", expiresBefore: placesCorridorExpiresBefore },
  { table: "osm_corridor_cache", expiresBefore: osmCorridorExpiresBefore },
  { table: "place_details_cache", expiresBefore: placeDetailsExpiresBefore },
  { table: "geocode_cache", expiresBefore: geocodeExpiresBefore },
];

async function deleteExpiredFromTable(admin, table, expiresBeforeFn) {
  const cutoff = expiresBeforeFn();
  const { error, count } = await admin
    .from(table)
    .delete({ count: "exact" })
    .lt("cached_at", cutoff);

  if (error) {
    console.error(`[cache-cleanup] ${table} delete failed:`, error.message);
    return { table, deleted: 0, error: error.message };
  }

  const deleted = count ?? 0;
  console.log(`[cache-cleanup] ${table}: deleted ${deleted} expired row(s) (cutoff ${cutoff})`);
  return { table, deleted, cutoff };
}

export async function runCacheCleanupJob() {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("Database not configured");

  const results = [];
  for (const { table, expiresBefore } of CACHE_TABLES) {
    results.push(await deleteExpiredFromTable(admin, table, expiresBefore));
  }

  const totalDeleted = results.reduce((sum, r) => sum + (r.deleted || 0), 0);
  console.log(`[cache-cleanup] total deleted: ${totalDeleted}`);

  return { totalDeleted, tables: results };
}
