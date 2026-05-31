import RouteDrawingLoader from "./RouteDrawingLoader.jsx";
import { getRouteTypeLabel, isScenicRoute } from "../lib/vehicles.js";

export default function MapRoutePill({
  routeInfo,
  answers,
  theme = "night",
  onNavigateHome = null,
  navigateHomePending = false,
}) {
  const showNavigateHome = typeof onNavigateHome === "function";

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
          {navigateHomePending ? (
            <RouteDrawingLoader theme={theme} variant="button" />
          ) : (
            "Navigate Home"
          )}
        </button>
      )}
      {routeInfo && (
        <>
          <div className="map-route-pill" aria-live="polite">
            {routeInfo.routeOptimized && <span className="map-route-badge map-route-badge-optimized">Optimized Route</span>}
            {routeInfo.truckSafe && <span className="map-route-badge">Truck Safe</span>}
            {routeInfo.rvSafe && <span className="map-route-badge">RV Safe</span>}
            {(routeInfo.scenic || isScenicRoute(answers)) && <span className="map-route-badge">Scenic</span>}
            <span className="map-route-pill-label">{getRouteTypeLabel(answers?.vehicle || routeInfo.vehicleType)}</span>
            <span className="map-route-pill-sep">·</span>
            <span className="map-route-pill-val">{routeInfo.distance}</span>
            <span className="map-route-pill-sep">·</span>
            <span className="map-route-pill-val">{routeInfo.duration}</span>
          </div>
        </>
      )}
    </div>
  );
}
