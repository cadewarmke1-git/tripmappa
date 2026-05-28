import { supabase } from "./supabaseClient.js";

/** Fetch an active live trip row by share token (anon-safe via RLS). */
export async function fetchLiveTripByToken(shareToken) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data: active, error: activeErr } = await supabase
    .from("live_trips")
    .select("*")
    .eq("share_token", shareToken)
    .eq("is_active", true)
    .maybeSingle();
  if (activeErr) throw activeErr;
  if (active) return active;

  const { data: complete, error: completeErr } = await supabase
    .from("live_trips")
    .select("*")
    .eq("share_token", shareToken)
    .not("arrived_at", "is", null)
    .maybeSingle();
  if (completeErr) throw completeErr;
  return complete;
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

/** Subscribe to live_trips postgres changes for a share token. */
export function subscribeLiveTrip(shareToken, onUpdate) {
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`live-trip-${shareToken}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "live_trips",
        filter: `share_token=eq.${shareToken}`,
      },
      payload => {
        if (payload.new) onUpdate(payload.new);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
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
