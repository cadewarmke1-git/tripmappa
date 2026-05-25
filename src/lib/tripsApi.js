import { supabase } from "./supabaseClient.js";

function rowToTrip(row) {
  return {
    id: row.id,
    origin: row.origin,
    dest: row.dest,
    date: row.trip_date || row.created_at?.slice(0, 10) || "",
    stops: row.stops || [],
    roadStops: row.road_stops || [],
    tripTips: row.trip_tips || [],
    answers: row.answers || {},
    routeInfo: row.route_info || null,
    selectedLodging: row.selected_lodging || [],
    createdAt: row.created_at,
  };
}

function tripToRow(userId, trip) {
  return {
    id: trip.id,
    user_id: userId,
    origin: trip.origin,
    dest: trip.dest,
    trip_date: trip.date || new Date().toLocaleDateString(),
    stops: trip.stops || [],
    road_stops: trip.roadStops || [],
    trip_tips: trip.tripTips || [],
    answers: trip.answers || {},
    route_info: trip.routeInfo || null,
    selected_lodging: trip.selectedLodging || [],
  };
}

export async function fetchTrips(userId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToTrip);
}

export async function saveTrip(userId, trip) {
  if (!supabase) throw new Error("Supabase is not configured");
  const payload = tripToRow(userId, {
    ...trip,
    id: trip.id || crypto.randomUUID(),
  });
  const { data, error } = await supabase
    .from("trips")
    .upsert(payload)
    .select()
    .single();
  if (error) throw error;
  return rowToTrip(data);
}

export async function deleteTrip(userId, tripId) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase
    .from("trips")
    .delete()
    .eq("id", tripId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function migrateLocalTrips(userId) {
  let local = [];
  try {
    local = JSON.parse(localStorage.getItem("tripmappa-saved") || "[]");
  } catch {
    local = [];
  }
  if (!local.length) return [];

  const migrated = [];
  for (const trip of local) {
    try {
      const saved = await saveTrip(userId, trip);
      migrated.push(saved);
    } catch (err) {
      console.warn("Could not migrate local trip:", err);
    }
  }
  try {
    localStorage.removeItem("tripmappa-saved");
  } catch {}
  return migrated;
}
