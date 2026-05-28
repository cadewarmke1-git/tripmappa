import { useEffect, useState } from "react";
import { getRouteTypeLabel, isScenicRoute } from "../lib/vehicles.js";

const LOADING_MESSAGES = [
  "Planning your route…",
  "Finding the best stops…",
  "Checking fuel stations…",
  "Almost ready…",
];

export default function MapRoutePill({
  routeInfo,
  answers,
  tripGenerating = false,
  loadingMessageIndex = 0,
  onNavigateHome = null,
  navigateHomePending = false,
}) {
  const [fade, setFade] = useState(true);
  const message = LOADING_MESSAGES[loadingMessageIndex % LOADING_MESSAGES.length];
  const showNavigateHome = typeof onNavigateHome === "function";

  useEffect(() => {
    if (!tripGenerating) return undefined;
    setFade(false);
    const t = setTimeout(() => setFade(true), 120);
    return () => clearTimeout(t);
  }, [loadingMessageIndex, tripGenerating]);

  if (!routeInfo && !showNavigateHome) return null;

  return (
    <div className={`map-route-pill-wrap${showNavigateHome ? " has-navigate-home" : ""}`}>
      {showNavigateHome && (
        <button
          type="button"
          className="navigate-home-map"
          onClick={onNavigateHome}
          disabled={navigateHomePending}
        >
          {navigateHomePending ? "Locating…" : "Navigate Home"}
        </button>
      )}
      {routeInfo && (
        <>
          <div className="map-route-pill" aria-live="polite">
            {routeInfo.truckSafe && <span className="map-route-badge">Truck Safe</span>}
            {routeInfo.rvSafe && <span className="map-route-badge">RV Safe</span>}
            {(routeInfo.scenic || isScenicRoute(answers)) && <span className="map-route-badge">Scenic</span>}
            <span className="map-route-pill-label">{getRouteTypeLabel(answers?.vehicle || routeInfo.vehicleType)}</span>
            <span className="map-route-pill-sep">·</span>
            <span className="map-route-pill-val">{routeInfo.distance}</span>
            <span className="map-route-pill-sep">·</span>
            <span className="map-route-pill-val">{routeInfo.duration}</span>
          </div>
          {tripGenerating && (
            <div className={`map-generating-msg${fade ? " visible" : ""}`} aria-live="polite">
              {message}
            </div>
          )}
        </>
      )}
    </div>
  );
}
