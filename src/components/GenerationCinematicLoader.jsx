/**
 * Generation loader — route drawing hero with thin gold progress.
 */
import RouteDrawingLoader from "./RouteDrawingLoader.jsx";

function shortCity(value) {
  return value?.split(",")[0]?.trim() || value?.trim() || "";
}

function skyPhaseToTheme(skyPhase) {
  if (skyPhase === "midday") return "day";
  return "night";
}

export default function GenerationCinematicLoader({
  progress = 0,
  subtitle = "",
  statusMessage = "",
  cityBeats = [],
  destination: _destination = "",
  vehicleType: _vehicleType = "Car",
  skyPhase = "night",
}) {
  const pct = Math.round(Math.min(100, Math.max(0, progress * 100)));
  const cities = (cityBeats || []).filter(Boolean);
  const activeCityIndex = cities.length
    ? Math.min(cities.length - 1, Math.floor(progress * cities.length))
    : 0;
  const activeCity = shortCity(cities[activeCityIndex] || "");
  const routeLabel = subtitle?.trim() || (activeCity ? `Mapping ${activeCity}` : "Mapping your route");
  const status = statusMessage?.trim() || routeLabel;

  return (
    <div className="generation-loader-route" aria-busy="true" aria-label="Generating your trip">
      <RouteDrawingLoader theme={skyPhaseToTheme(skyPhase)} variant="fullscreen" className="generation-loader-route-drawing" />
      <div className="generation-loader-live" aria-live="polite">
        <p className="generation-loader-subtitle">{routeLabel}</p>
        {activeCity && cities.length > 1 && (
          <p className="generation-loader-city">{activeCity}</p>
        )}
        <p className="generation-loader-status">{status}</p>
        <div className="generation-loader-progress-wrap">
          <div
            className="generation-loader-progress-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label="Trip generation progress"
          >
            <div className="generation-loader-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="generation-loader-progress-pct">{pct}%</span>
        </div>
      </div>
    </div>
  );
}
