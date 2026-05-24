import { Autocomplete } from "@react-google-maps/api";
import { isWaterVehicle, getRouteTypeLabel, isScenicRoute } from "../lib/vehicles.js";

export default function RouteFooter({
  isLoaded,
  origin,
  dest,
  answers,
  routeInfo,
  timingMode,
  routeTimingOpen,
  arriveByDate,
  originRef,
  destRef,
  onSwap,
  onFetchDirections,
  onSetOrigin,
  onSetDest,
  onSetTimingMode,
  onSetRouteTimingOpen,
  onSetArriveByDate,
}) {
  return (
    <div className="route-footer">
      <div className="route-fields">
        <div className="route-input-wrap">
          <div className="route-dot"/>
          {isLoaded ? (
            <Autocomplete onPlaceChanged={() => answers.vehicle && onFetchDirections(answers.vehicle)} options={{ types: ["geocode", "establishment"] }}>
              <input ref={originRef} className="route-input" placeholder="Starting from…" defaultValue={origin}/>
            </Autocomplete>
          ) : (
            <input className="route-input" placeholder="Starting from…" value={origin} onChange={e => onSetOrigin(e.target.value)}/>
          )}
        </div>
        <div className="route-divider-wrap">
          <div className="route-divider"/>
          <button type="button" className="route-swap-btn" onClick={onSwap} aria-label="Swap origin and destination">↕</button>
        </div>
        <div className="route-input-wrap">
          <div className="route-dot dest"/>
          {isLoaded ? (
            <Autocomplete onPlaceChanged={() => answers.vehicle && onFetchDirections(answers.vehicle)} options={{ types: ["geocode", "establishment"] }}>
              <input ref={destRef} className="route-input" placeholder="Going to…" defaultValue={dest}/>
            </Autocomplete>
          ) : (
            <input className="route-input" placeholder="Going to…" value={dest} onChange={e => onSetDest(e.target.value)}/>
          )}
        </div>
      </div>
      <div className="route-timing-wrap">
        <button type="button" className="route-timing-btn" onClick={() => onSetRouteTimingOpen(o => !o)}>
          {timingMode === "leave_now" ? "Leave now" : arriveByDate ? `Arrive by ${new Date(arriveByDate).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "Arrive by"} ▾
        </button>
        {routeTimingOpen && (
          <div className="route-timing-menu" role="menu">
            <button type="button" role="menuitem" className={`route-timing-menu-item${timingMode === "leave_now" ? " active" : ""}`} onClick={() => { onSetTimingMode("leave_now"); onSetRouteTimingOpen(false); if (originRef.current?.value && destRef.current?.value && answers.vehicle) onFetchDirections(answers.vehicle); }}>Leave now</button>
            <button type="button" role="menuitem" className={`route-timing-menu-item${timingMode === "arrive_by" ? " active" : ""}`} onClick={() => { onSetTimingMode("arrive_by"); onSetRouteTimingOpen(false); }}>Arrive by</button>
          </div>
        )}
        {timingMode === "arrive_by" && (
          <input
            type="datetime-local"
            className="route-arrive-picker"
            value={arriveByDate}
            min={new Date().toISOString().slice(0, 16)}
            onChange={e => { onSetArriveByDate(e.target.value); if (e.target.value && originRef.current?.value && destRef.current?.value && answers.vehicle) onFetchDirections(answers.vehicle); }}
          />
        )}
      </div>
      {routeInfo && (
        <div className="route-info-chip-wrap">
          <div className="route-info-chip">
            {routeInfo.truckSafe && <span className="route-truck-badge">Truck Safe Route</span>}
            {routeInfo.rvSafe && <span className="route-rv-badge">RV Safe Route</span>}
            {(routeInfo.scenic || isScenicRoute(answers)) && <span className="route-scenic-badge">Scenic Route</span>}
            <span className="route-chip-label">{getRouteTypeLabel(answers.vehicle || routeInfo.vehicleType)}</span>
            <span className="route-chip-sep">·</span>
            <span className="route-chip-val">{routeInfo.distance}</span>
            <span className="route-chip-sep">·</span>
            <span className="route-chip-val">{routeInfo.duration}</span>
          </div>
          {isWaterVehicle(answers.vehicle) && (
            <div className="water-route-note">Routing is approximate — Google Maps does not support marine routes.</div>
          )}
        </div>
      )}
    </div>
  );
}
