import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SKY_LIVE_TICK_MS,
  getLiveSkyHour,
  isSkyTestEnabled,
  parseSkyHourParam,
  resolveHeroSkyHour,
} from "../lib/heroSky.js";

function prefersReducedMotion() {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function useHeroSkyHour() {
  const urlHour = useMemo(() => parseSkyHourParam(window.location.search), []);
  const skyTestEnabled = useMemo(() => isSkyTestEnabled(window.location.search), []);

  const [liveHour, setLiveHour] = useState(getLiveSkyHour);
  const [dialOverride, setDialOverride] = useState(null);

  const isLive = dialOverride == null && urlHour == null;

  useEffect(() => {
    if (!isLive) return undefined;

    const tick = () => setLiveHour(getLiveSkyHour());
    tick();

    const intervalMs = prefersReducedMotion() ? 60_000 : SKY_LIVE_TICK_MS;
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [isLive]);

  const skyHour = resolveHeroSkyHour({ liveHour, dialOverride, urlHour });
  const isDialOverridden = dialOverride != null && urlHour == null;

  const setSkyHourOverride = useCallback(hour => {
    setDialOverride(hour);
  }, []);

  const resetToLive = useCallback(() => {
    setDialOverride(null);
  }, []);

  return {
    skyHour,
    liveHour,
    skyTestEnabled,
    isDialOverridden,
    isUrlLocked: urlHour != null,
    setSkyHourOverride,
    resetToLive,
  };
}
