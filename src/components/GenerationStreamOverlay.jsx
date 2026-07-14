/** Real-time generation progress overlay during SSE streaming. */
import { useEffect, useMemo, useState } from "react";
import PulsingWordmark from "./PulsingWordmark.jsx";
// GenerationCinematicLoader kept available for optional / future use — not primary.
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
  /** Use cinematic car/sky loader instead of centered PulsingWordmark. Default off. */
  useCinematicLoader = false,
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

  const pct = Math.round(Math.min(1, Math.max(0, displayFraction)) * 100);

  if (useCinematicLoader) {
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

  return (
    <div
      className="generation-stream-overlay generation-stream-overlay--wordmark"
      aria-live="polite"
      aria-busy="true"
    >
      <PulsingWordmark size="lg" centered={false} className="generation-pulsing-wordmark" />
      <p className="generation-loader-subtitle">{routeSubtitle}</p>
      {stream.message ? (
        <p className="generation-loader-status">{stream.message}</p>
      ) : null}
      <div className="generation-loader-progress-wrap" aria-hidden="true">
        <div className="generation-loader-progress-bar">
          <div
            className="generation-loader-progress-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="generation-loader-progress-pct">{pct}%</span>
      </div>
    </div>
  );
}
