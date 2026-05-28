import { getRouteTypeLabel, isScenicRoute } from "../lib/vehicles.js";
import RouteFooter from "./RouteFooter.jsx";

/** Pinned bottom of plan panel — Navigate Home, route stats, origin/dest fields. */
export default function PlanPanelDock({
  routeInfo,
  answers,
  navigateHomePending,
  onNavigateHome,
  isLoaded,
  origin,
  dest,
  timingMode,
  arriveByDate,
  originRef,
  destRef,
  onSwap,
  onFetchDirections,
  onSetOrigin,
  onSetDest,
  onSetTimingMode,
  onSetArriveByDate,
}) {
  return (
    <div className="plan-panel-dock">
      <RouteFooter
        isLoaded={isLoaded}
        origin={origin}
        dest={dest}
        answers={answers}
        timingMode={timingMode}
        arriveByDate={arriveByDate}
        originRef={originRef}
        destRef={destRef}
        onSwap={onSwap}
        onFetchDirections={onFetchDirections}
        onSetOrigin={onSetOrigin}
        onSetDest={onSetDest}
        onSetTimingMode={onSetTimingMode}
        onSetArriveByDate={onSetArriveByDate}
      />
      <button
        type="button"
        className="navigate-home-dock"
        onClick={onNavigateHome}
        disabled={navigateHomePending}
      >
        {navigateHomePending ? "Locating…" : "Navigate Home"}
      </button>
      {routeInfo?.distance && routeInfo?.duration && (
        <div className="plan-route-info-bar" aria-label="Route summary">
          {routeInfo.truckSafe && <span className="plan-route-info-badge">Truck Safe</span>}
          {routeInfo.rvSafe && <span className="plan-route-info-badge">RV Safe</span>}
          {(routeInfo.scenic || isScenicRoute(answers)) && (
            <span className="plan-route-info-badge">Scenic</span>
          )}
          <span className="plan-route-info-type">{getRouteTypeLabel(answers?.vehicle || routeInfo.vehicleType)}</span>
          <span className="plan-route-info-sep" aria-hidden="true">·</span>
          <span className="plan-route-info-val">{routeInfo.distance}</span>
          <span className="plan-route-info-sep" aria-hidden="true">·</span>
          <span className="plan-route-info-val">{routeInfo.duration}</span>
        </div>
      )}
    </div>
  );
}
