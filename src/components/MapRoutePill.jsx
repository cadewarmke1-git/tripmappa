import { getRouteTypeLabel, isScenicRoute } from "../lib/vehicles.js";

export default function MapRoutePill({ routeInfo, answers }) {
  if (!routeInfo) return null;

  return (
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
  );
}
