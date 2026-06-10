import { tripMappaApiHeaders } from "./tripmappaHeaders.js";
import { supabase } from "./supabaseClient.js";

const POLL_INTERVAL_MS = 5000;

/** Fetch an active live trip row by share token via server API (no table enumeration). */
export async function fetchLiveTripByToken(shareToken) {
  const res = await fetch(`/api/live-trip?token=${encodeURIComponent(shareToken)}`, {
    headers: tripMappaApiHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Could not load live trip");
  const data = await res.json();
  return data.liveTrip || null;
}

/** Stop sharing — owner only (RLS). */
export async function stopLiveShare(shareToken, userId) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase
    .from("live_trips")
    .update({ is_active: false })
    .eq("share_token", shareToken)
    .eq("user_id", userId);
  if (error) throw error;
}

/** Poll live trip updates by share token (replaces broad anon realtime subscriptions). */
export function subscribeLiveTrip(shareToken, onUpdate) {
  if (!shareToken) return () => {};

  let cancelled = false;

  async function poll() {
    if (cancelled) return;
    try {
      const row = await fetchLiveTripByToken(shareToken);
      if (row && !cancelled) onUpdate(row);
    } catch {
      // ignore transient poll errors
    }
  }

  poll();
  const intervalId = window.setInterval(poll, POLL_INTERVAL_MS);

  return () => {
    cancelled = true;
    window.clearInterval(intervalId);
  };
}

/** Join presence channel to track live viewers. */
export function joinLivePresence(shareToken, { viewerId, viewerName, onViewersChange }) {
  if (!supabase) return () => {};

  const channel = supabase.channel(`live-presence-${shareToken}`, {
    config: { presence: { key: viewerId } },
  });

  const syncViewers = () => {
    const state = channel.presenceState();
    const viewers = Object.entries(state).flatMap(([key, presences]) =>
      (presences || []).map(p => ({
        id: key,
        name: p.name || "Anonymous Viewer",
        onlineAt: p.online_at,
      })),
    );
    onViewersChange?.(viewers);
  };

  channel
    .on("presence", { event: "sync" }, syncViewers)
    .on("presence", { event: "join" }, syncViewers)
    .on("presence", { event: "leave" }, syncViewers)
    .subscribe(async status => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          name: viewerName || "Anonymous Viewer",
          online_at: new Date().toISOString(),
        });
        syncViewers();
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

export function mapLiveTripRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    tripId: row.trip_id,
    shareToken: row.share_token,
    latitude: row.latitude,
    longitude: row.longitude,
    lastUpdated: row.last_updated,
    origin: row.origin,
    destination: row.destination,
    eta: row.eta,
    etaDestination: row.eta_destination,
    etaNextStop: row.eta_next_stop,
    nextStopName: row.next_stop_name,
    isActive: row.is_active,
    stops: row.stops || [],
    routeInfo: row.route_info || null,
    travelerDisplayName: row.traveler_display_name,
    travelerAvatarUrl: row.traveler_avatar_url,
    convoyMode: row.convoy_mode,
    convoyMembers: row.convoy_members || [],
    breadcrumbs: row.breadcrumbs || [],
    lastNotification: row.last_notification,
    arrivedAt: row.arrived_at,
    tripStartedAt: row.trip_started_at,
    totalDistanceMiles: row.total_distance_miles,
    ownerSpeedMph: row.owner_speed_mph,
    ownerDistanceToDest: row.owner_distance_to_dest,
    createdAt: row.created_at,
  };
}
