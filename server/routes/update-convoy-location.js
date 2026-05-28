import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { getGoogleMapsKey } from "../lib/googleKey.js";
import { mphFromSpeedMps } from "../lib/liveTripHelpers.js";

async function fetchMatrixEta(originLat, originLng, destination) {
  const key = getGoogleMapsKey();
  if (!key || !destination) return null;
  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", `${originLat},${originLng}`);
  url.searchParams.set("destinations", destination);
  url.searchParams.set("key", key);
  url.searchParams.set("departure_time", "now");
  const res = await fetch(url);
  const data = await res.json();
  const el = data.rows?.[0]?.elements?.[0];
  if (!el || el.status !== "OK") return null;
  return {
    distanceText: el.distance?.text || null,
  };
}

/** POST /api/update-convoy-location — update a convoy member's GPS on the shared map. */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return res.status(503).json({ error: "Database not configured" });
  }

  const { shareToken, memberId, latitude, longitude, speedMps = null } = req.body || {};
  if (!shareToken || !memberId || latitude == null || longitude == null) {
    return res.status(400).json({ error: "Missing shareToken, memberId, latitude, or longitude" });
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  try {
    const { data: trip, error: fetchErr } = await admin
      .from("live_trips")
      .select("*")
      .eq("share_token", shareToken)
      .eq("is_active", true)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!trip?.convoy_mode) {
      return res.status(404).json({ error: "Convoy trip not found" });
    }

    const destEta = await fetchMatrixEta(lat, lng, trip.destination);
    const members = (trip.convoy_members || []).map(m => {
      if (m.id !== memberId) return m;
      return {
        ...m,
        latitude: lat,
        longitude: lng,
        speed_mph: mphFromSpeedMps(speedMps),
        distance_to_dest: destEta?.distanceText || m.distance_to_dest || null,
        last_updated: new Date().toISOString(),
      };
    });

    if (!members.some(m => m.id === memberId)) {
      return res.status(404).json({ error: "Convoy member not found" });
    }

    const { data, error } = await admin
      .from("live_trips")
      .update({ convoy_members: members })
      .eq("share_token", shareToken)
      .select()
      .single();

    if (error) throw error;
    return res.status(200).json({ liveTrip: data });
  } catch (err) {
    console.error("update-convoy-location error:", err);
    return res.status(500).json({ error: "Could not update convoy location" });
  }
}
