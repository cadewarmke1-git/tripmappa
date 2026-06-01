import { useEffect, useMemo, useState } from "react";
import { fetchLiveTripTips } from "../lib/tripTipsClient.js";

function mergeTips(liveTips, fallbackTips, max = 5) {
  const seen = new Set();
  const lines = [];
  [...liveTips, ...fallbackTips].forEach((tip) => {
    const line = typeof tip === "string" ? tip : (tip?.message || tip?.title);
    if (!line || seen.has(line)) return;
    seen.add(line);
    lines.push(line);
  });
  return lines.slice(0, max);
}

export function useLiveTripTips({
  generated,
  origin,
  dest,
  routePoints = [],
  stops = [],
  liveSharingActive = false,
  fallbackTips = [],
  pollMs = 3 * 60 * 1000,
}) {
  const [liveTips, setLiveTips] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Snapshot stop waypoints when a trip is generated — omit stops from deps so enrichment updates do not re-fetch.
  const stableWaypoints = useMemo(() => {
    if (!generated) return [];
    return stops
      .filter(s => s.lat != null && s.lng != null)
      .map(s => ({ lat: s.lat, lng: s.lng }));
  }, [generated, origin, dest]);

  useEffect(() => {
    if (!generated || !origin || !dest) return undefined;
    let cancelled = false;

    async function refresh() {
      setRefreshing(true);
      try {
        const result = await fetchLiveTripTips({
          origin,
          destination: dest,
          routePoints,
          waypoints: stableWaypoints,
        });
        if (cancelled) return;
        if (result.tips?.length) {
          setLiveTips(result.tips);
          setUpdatedAt(result.updatedAt || Date.now());
        }
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    }

    refresh();
    if (!liveSharingActive) {
      return () => { cancelled = true; };
    }

    const id = window.setInterval(refresh, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [generated, origin, dest, routePoints, stableWaypoints, liveSharingActive, pollMs]);

  const tips = useMemo(
    () => mergeTips(liveTips, fallbackTips),
    [liveTips, fallbackTips],
  );

  return { tips, updatedAt, refreshing, liveTips };
}
