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

function LegProgress({ current, total, nextName }) {
  if (total <= 1) return null;
  const pct = Math.round(((current) / Math.max(total - 1, 1)) * 100);
  return (
    <div className="nav-cockpit-legs" aria-label={`Stop ${current + 1} of ${total}`}>
      <div className="nav-cockpit-legs-label">
        <span className="nav-cockpit-legs-eyebrow">Trip progress</span>
        <span className="nav-cockpit-legs-stop">Next: {nextName}</span>
      </div>
      <div className="nav-cockpit-legs-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <span className="nav-cockpit-legs-fill" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="nav-cockpit-legs-count">{current + 1} / {total} stops</span>
    </div>
  );
}

function NextStopCard({ context }) {
  if (!context) return null;
  return (
    <div className="nav-cockpit-planned" aria-label={`Planned ${context.kind}: ${context.title}`}>
      <div className="nav-cockpit-planned-head">
        <span className="nav-cockpit-planned-kind">{context.kind}</span>
        {context.weather && (
          <span className="nav-cockpit-planned-weather" title={context.weather.condition}>
            <WeatherIcon type={resolveWeatherIconType(context.weather.condition)} />
            {context.weather.temp}
          </span>
        )}
      </div>
      <div className="nav-cockpit-planned-title">{context.title}</div>
      {context.city && <div className="nav-cockpit-planned-city">{context.city}</div>}
      {context.lines?.length > 0 && (
        <ul className="nav-cockpit-planned-lines">
          {context.lines.map((line) => (
            <li key={`${line.type}-${line.text}`} className={`nav-cockpit-planned-line nav-cockpit-planned-line--${line.type}`}>
              {line.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TurnByTurnPanel({
  navDisplay,
  theme = "night",
  arrivingStop = null,
  arrivalContext = null,
  onDismissArrival,
  onEndNavigation,
  onRecenter,
  tripStops = [],
  passedStopIds = new Set(),
  gpsWaiting = false,
  nextStopContext = null,
  liveSharingActive = false,
}) {
  if (!navDisplay) return null;

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
    currentLegIndex,
    totalLegs,
    speedMph,
    offRoute,
    gpsError,
    hasGps,
    showDualEta,
  } = navDisplay;

  return (
    <aside className={`nav-cockpit nav-cockpit--${theme}`} aria-label="Turn-by-turn navigation">
      {liveSharingActive && (
        <div className="nav-cockpit-live" role="status">
          <span className="nav-cockpit-live-dot" aria-hidden="true" />
          Live location shared with your group
        </div>
      )}

      {offRoute && (
        <div className="nav-cockpit-offroute" role="status">
          You may be off route — check your heading
        </div>
      )}

      {arrivingStop && (
        <div className="nav-cockpit-arrival" role="status">
          <span className="nav-cockpit-arrival-label">
            {arrivalContext?.kind ? `Arriving — ${arrivalContext.kind}` : "Arriving at"}
          </span>
          <span className="nav-cockpit-arrival-name">{arrivalContext?.title || arrivingStop.title}</span>
          {arrivalContext?.subtitle && (
            <span className="nav-cockpit-arrival-sub">{arrivalContext.subtitle}</span>
          )}
          {arrivalContext?.weather && (
            <span className="nav-cockpit-arrival-weather">
              <WeatherIcon type={resolveWeatherIconType(arrivalContext.weather.condition)} />
              {arrivalContext.weather.temp}
            </span>
          )}
          <button type="button" className="nav-cockpit-arrival-dismiss" onClick={onDismissArrival}>Got it</button>
        </div>
      )}

      {gpsError && (
        <div className="nav-cockpit-gps-warn" role="alert">{gpsError}</div>
      )}

      {gpsWaiting && !hasGps && !gpsError && (
        <div className="nav-cockpit-gps-warn" role="status">Acquiring GPS signal…</div>
      )}

      <div className="nav-cockpit-primary">
        <div className="nav-cockpit-maneuver">
          <ManeuverIcon maneuver={maneuver} />
        </div>
        <div className="nav-cockpit-instruction-block">
          <div className="nav-cockpit-distance">{distanceToTurn}</div>
          <p className="nav-cockpit-instruction">{instruction}</p>
        </div>
        {speedMph != null && speedMph > 0 && (
          <div className="nav-cockpit-speed" aria-label={`${speedMph} miles per hour`}>
            <span className="nav-cockpit-speed-val">{speedMph}</span>
            <span className="nav-cockpit-speed-unit">mph</span>
          </div>
        )}
      </div>

      {nextInstruction && (
        <div className="nav-cockpit-then">
          <span className="nav-cockpit-then-label">Then</span>
          <span className="nav-cockpit-then-text">{nextInstruction}</span>
        </div>
      )}

      <LegProgress current={currentLegIndex} total={totalLegs} nextName={nextStopName} />

      <NextStopCard context={nextStopContext} />

      <div className={`nav-cockpit-eta-row${showDualEta ? "" : " nav-cockpit-eta-row--single"}`}>
        {showDualEta ? (
          <>
            <div className="nav-cockpit-eta-cell">
              <span className="nav-cockpit-eta-label">To {nextStopName}</span>
              <span className="nav-cockpit-eta-val">{etaNextStop}</span>
              <span className="nav-cockpit-eta-sub">{distanceToNextStop}</span>
            </div>
            <div className="nav-cockpit-eta-divider" aria-hidden="true" />
            <div className="nav-cockpit-eta-cell">
              <span className="nav-cockpit-eta-label">Destination</span>
              <span className="nav-cockpit-eta-val">{etaDestination}</span>
              <span className="nav-cockpit-eta-sub">{distanceRemaining}</span>
            </div>
          </>
        ) : (
          <div className="nav-cockpit-eta-cell nav-cockpit-eta-cell--solo">
            <span className="nav-cockpit-eta-label">Destination</span>
            <span className="nav-cockpit-eta-val">{etaDestination}</span>
            <span className="nav-cockpit-eta-sub">{distanceRemaining}</span>
          </div>
        )}
      </div>

      {tripStops.length > 0 && (
        <div className="nav-cockpit-queue" aria-label="Upcoming stops">
          <span className="nav-cockpit-queue-title">Your corridor</span>
          <ul className="nav-cockpit-queue-list">
            {tripStops.slice(0, 5).map((stop, i) => {
              const passed = passedStopIds.has(stop.id);
              const current = i === currentLegIndex && !passed;
              return (
                <li
                  key={stop.id}
                  className={`nav-cockpit-queue-item${passed ? " nav-cockpit-queue-item--passed" : ""}${current ? " nav-cockpit-queue-item--current" : ""}`}
                >
                  <span className="nav-cockpit-queue-dot" aria-hidden="true" />
                  <span className="nav-cockpit-queue-name">{stop.title}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="nav-cockpit-actions">
        {onRecenter && (
          <button type="button" className="nav-cockpit-btn nav-cockpit-btn-secondary" onClick={onRecenter}>
            Center on me
          </button>
        )}
        {onEndNavigation && (
          <button type="button" className="nav-cockpit-btn nav-cockpit-btn-end" onClick={onEndNavigation}>
            End navigation
          </button>
        )}
      </div>
    </aside>
  );
}
