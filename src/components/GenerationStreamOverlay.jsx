/** Real-time generation progress overlay during SSE streaming. */
import { useEffect, useMemo, useState } from "react";
import BrandWordmark from "./BrandWordmark.jsx";

function formatRouteLine(origin, dest, routeSummary) {
  const short = (value) => value?.split(",")[0]?.trim() || value?.trim() || "";
  if (origin?.trim() && dest?.trim()) {
    return `${short(origin)} to ${short(dest)}`;
  }
  return routeSummary?.trim() || null;
}

export default function GenerationStreamOverlay({ progress, origin, dest }) {
  const cities = useMemo(
    () => [...new Set((progress?.cityNames || []).filter(Boolean))],
    [progress?.cityNames],
  );
  const [cityIndex, setCityIndex] = useState(0);

  useEffect(() => {
    setCityIndex(0);
  }, [cities.join("|")]);

  useEffect(() => {
    if (cities.length <= 1) return undefined;
    const timer = setInterval(() => {
      setCityIndex((current) => (current + 1) % cities.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [cities.length]);

  if (!progress) return null;

  const statusMessage = cities.length > 0
    ? cities[cityIndex]
    : "Planning your route...";

  const routeLine = formatRouteLine(origin, dest, progress.routeSummary);

  return (
    <div className="generation-stream-overlay" aria-live="polite" aria-busy="true">
      <div className="generation-stream-body">
        <div className="generation-stream-hero">
          <div className="generation-stream-glow" aria-hidden="true" />
          <BrandWordmark as="div" className="generation-stream-wordmark" />
        </div>
        <p className="generation-stream-message">{statusMessage}</p>
      </div>
      {routeLine && (
        <p className="generation-stream-route">{routeLine}</p>
      )}
    </div>
  );
}
