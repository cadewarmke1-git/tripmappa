/** Real-time generation progress overlay during SSE streaming. */
import { useEffect, useMemo, useState } from "react";
import GenerationCinematicLoader from "./GenerationCinematicLoader.jsx";
import {
  computeGenerationProgressFraction,
  createInitialGenerationProgress,
} from "../lib/planTripStream.js";

function shortCity(value) {
  return value?.split(",")[0]?.trim() || value?.trim() || "";
}

function themeToSkyPhase(theme) {
  if (theme === "day") return "midday";
  if (theme === "twilight") return "golden_hour";
  return "night";
}

export default function GenerationStreamOverlay({
  progress,
  origin,
  dest,
  vehicleType = "Car",
  theme = "night",
  routeCities = [],
}) {
  const stream = progress || createInitialGenerationProgress({ cityNames: routeCities });

  const [displayFraction, setDisplayFraction] = useState(() => computeGenerationProgressFraction(stream));

  const targetFraction = useMemo(
    () => computeGenerationProgressFraction(stream),
    [stream],
  );

  useEffect(() => {
    setDisplayFraction((prev) => Math.max(prev, targetFraction));
  }, [targetFraction]);

  useEffect(() => {
    if (targetFraction >= 0.92) return undefined;
    const timer = window.setInterval(() => {
      setDisplayFraction((prev) => {
        const ceiling = Math.max(targetFraction, 0.05);
        if (prev >= ceiling + 0.02) return prev;
        return Math.min(ceiling + 0.02, prev + 0.004);
      });
    }, 400);
    return () => window.clearInterval(timer);
  }, [targetFraction]);

  useEffect(() => {
    if (targetFraction < 0.9) return undefined;
    const timer = window.setInterval(() => {
      setDisplayFraction((prev) => (prev >= 0.998 ? 1 : Math.min(1, prev + 0.03)));
    }, 40);
    return () => window.clearInterval(timer);
  }, [targetFraction]);

  const cityBeats = useMemo(() => {
    const fromStream = [...new Set((stream.cityNames || []).filter(Boolean))];
    if (fromStream.length) return fromStream;
    return [...new Set((routeCities || []).filter(Boolean))];
  }, [stream.cityNames, routeCities]);

  const routeSubtitle = useMemo(() => {
    const o = shortCity(origin);
    const d = shortCity(dest);
    if (o && d) return `${o} → ${d}`;
    return stream.routeSummary?.trim() || stream.message || "Mapping your route";
  }, [origin, dest, stream.routeSummary, stream.message]);

  return (
    <div className="generation-stream-overlay" aria-live="polite" aria-busy="true">
      <GenerationCinematicLoader
        progress={displayFraction}
        vehicleType={vehicleType}
        skyPhase={themeToSkyPhase(theme)}
        cityBeats={cityBeats}
        subtitle={routeSubtitle}
        destination={dest}
        statusMessage={stream.message}
      />
    </div>
  );
}
