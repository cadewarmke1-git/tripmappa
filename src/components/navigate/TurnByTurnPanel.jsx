import { maneuverIconKey } from "../../lib/navigationSteps.js";
import WeatherIcon from "../icons/WeatherIcon.jsx";
import { resolveWeatherIconType } from "../../lib/weatherIconTypes.js";

function ManeuverIcon({ maneuver, className = "" }) {
  const key = maneuverIconKey(maneuver);
  const paths = {
    straight: "M12 4v16M8 8l4-4 4 4",
    left: "M9 6l-6 6 6 6M3 12h14a4 4 0 0 0 4-4V6",
    right: "M15 6l6 6-6 6M21 12H7a4 4 0 0 1-4-4V6",
    "slight-left": "M8 7l-4 5h6l2 10",
    "slight-right": "M16 7l4 5h-6l-2 10",
    "sharp-left": "M7 5L3 12l4 7M3 12h12",
    "sharp-right": "M17 5l4 7-4 7M21 12H9",
    "u-turn-left": "M9 8v4a4 4 0 0 0 4 4h4M9 8l-3-3M9 8l3-3",
    "u-turn-right": "M15 8v4a4 4 0 0 1-4 4H7M15 8l3-3M15 8l-3-3",
    roundabout: "M12 6a6 6 0 1 0 0 12M12 6V3M12 18v3",
    merge: "M6 12h12M12 6l6 6-6 6",
    fork: "M12 4v8M8 12l4 8 4-8",
    ramp: "M6 16l6-12 6 12",
  };
  const d = paths[key] || paths.straight;
  return (
    <svg className={`nav-maneuver-icon${className ? ` ${className}` : ""}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function TurnByTurnPanel({
  isNavigating = false,
  navDisplay,
  theme = "night",
  arrivingStop = null,
  arrivalContext = null,
  onDismissArrival,
  onEndNavigation,
  onRecenter,
  gpsWaiting = false,
  nextStopContext = null,
  liveSharingActive = false,
}) {
  if (!isNavigating || !navDisplay) return null;

  const {
    instruction,
    distanceToTurn,
    nextInstruction,
    maneuver,
    etaNextStop,
    etaDestination,
    distanceRemaining,
    distanceToNextStop,
    nextStopName,
    speedMph,
    offRoute,
    gpsError,
    hasGps,
    showDualEta,
  } = navDisplay;

  return (
    <aside className={`nav-cockpit nav-cockpit--compact nav-cockpit--${theme}`} aria-label="Turn-by-turn navigation">
      {liveSharingActive && (
        <div className="nav-cockpit-live nav-cockpit-live--compact" role="status">
          <span className="nav-cockpit-live-dot" aria-hidden="true" />
          Live
        </div>
      )}

      {offRoute && (
        <div className="nav-cockpit-offroute nav-cockpit-offroute--compact" role="status">
          Off route — check heading
        </div>
      )}

      {arrivingStop && (
        <div className="nav-cockpit-arrival nav-cockpit-arrival--compact" role="status">
          <span className="nav-cockpit-arrival-label">
            {arrivalContext?.kind ? `Arriving — ${arrivalContext.kind}` : "Arriving"}
          </span>
          <span className="nav-cockpit-arrival-name">{arrivalContext?.title || arrivingStop.title}</span>
          {arrivalContext?.weather && (
            <span className="nav-cockpit-arrival-weather">
              <WeatherIcon type={resolveWeatherIconType(arrivalContext.weather.condition)} />
              {arrivalContext.weather.temp}
            </span>
          )}
          <button type="button" className="nav-cockpit-arrival-dismiss" onClick={onDismissArrival}>OK</button>
        </div>
      )}

      {gpsError && (
        <div className="nav-cockpit-gps-warn nav-cockpit-gps-warn--compact" role="alert">{gpsError}</div>
      )}

      {gpsWaiting && !hasGps && !gpsError && (
        <div className="nav-cockpit-gps-warn nav-cockpit-gps-warn--compact" role="status">Acquiring GPS…</div>
      )}

      <div className="nav-cockpit-primary nav-cockpit-primary--compact">
        <div className="nav-cockpit-maneuver nav-cockpit-maneuver--compact">
          <ManeuverIcon maneuver={maneuver} />
        </div>
        <div className="nav-cockpit-instruction-block">
          <div className="nav-cockpit-distance nav-cockpit-distance--compact">{distanceToTurn}</div>
          <p className="nav-cockpit-instruction nav-cockpit-instruction--compact">{instruction}</p>
          {nextInstruction && (
            <p className="nav-cockpit-then nav-cockpit-then--inline">
              <span className="nav-cockpit-then-label">Then</span>
              {nextInstruction}
            </p>
          )}
        </div>
        {speedMph != null && speedMph > 0 && (
          <div className="nav-cockpit-speed nav-cockpit-speed--compact" aria-label={`${speedMph} miles per hour`}>
            <span className="nav-cockpit-speed-val">{speedMph}</span>
            <span className="nav-cockpit-speed-unit">mph</span>
          </div>
        )}
      </div>

      <div className="nav-cockpit-footer nav-cockpit-footer--compact">
        <div className={`nav-cockpit-eta-row nav-cockpit-eta-row--compact${showDualEta ? "" : " nav-cockpit-eta-row--single"}`}>
          {showDualEta ? (
            <>
              <div className="nav-cockpit-eta-cell">
                <span className="nav-cockpit-eta-val">{etaNextStop}</span>
                <span className="nav-cockpit-eta-sub">{nextStopName} · {distanceToNextStop}</span>
              </div>
              <div className="nav-cockpit-eta-divider" aria-hidden="true" />
              <div className="nav-cockpit-eta-cell">
                <span className="nav-cockpit-eta-val">{etaDestination}</span>
                <span className="nav-cockpit-eta-sub">Dest · {distanceRemaining}</span>
              </div>
            </>
          ) : (
            <div className="nav-cockpit-eta-cell nav-cockpit-eta-cell--solo">
              <span className="nav-cockpit-eta-val">{etaDestination}</span>
              <span className="nav-cockpit-eta-sub">{distanceRemaining} remaining</span>
            </div>
          )}
        </div>

        <div className="nav-cockpit-actions nav-cockpit-actions--compact">
          {onRecenter && (
            <button type="button" className="nav-cockpit-btn nav-cockpit-btn-icon" onClick={onRecenter} aria-label="Center on me">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}
          {onEndNavigation && (
            <button type="button" className="nav-cockpit-btn nav-cockpit-btn-end nav-cockpit-btn-end--compact" onClick={onEndNavigation}>
              End
            </button>
          )}
        </div>
      </div>

      {nextStopContext?.title && (
        <div className="nav-cockpit-planned nav-cockpit-planned--compact" aria-label={`Next planned stop: ${nextStopContext.title}`}>
          <span className="nav-cockpit-planned-kind">{nextStopContext.kind}</span>
          <span className="nav-cockpit-planned-title">{nextStopContext.title}</span>
        </div>
      )}
    </aside>
  );
}
