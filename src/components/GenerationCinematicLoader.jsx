/**
 * GenerationCinematicLoader
 * Loading skeleton shown while trip generation streams.
 */

const DAY_STOP_COUNTS = [3, 2, 3];

function shortCity(value) {
  return value?.split(",")[0]?.trim() || value?.trim() || "";
}

export default function GenerationCinematicLoader({
  progress = 0,
  subtitle = "",
  statusMessage = "",
  cityBeats = [],
  destination: _destination = "",
  vehicleType: _vehicleType = "Car",
  skyPhase: _skyPhase = "sunset",
}) {
  const pct = Math.round(Math.min(100, Math.max(0, progress * 100)));
  const cities = (cityBeats || []).filter(Boolean);
  const activeCityIndex = cities.length
    ? Math.min(cities.length - 1, Math.floor(progress * cities.length))
    : 0;
  const activeCity = shortCity(cities[activeCityIndex] || "");
  const status = statusMessage?.trim() || subtitle?.trim() || "Planning your trip…";

  return (
    <div className="generation-loader-skeleton" aria-busy="true" aria-label="Generating your trip">
      <div className="generation-loader-skeleton-panel">
        <div className="generation-loader-live" aria-live="polite">
          {subtitle && (
            <p className="generation-loader-subtitle">{subtitle}</p>
          )}
          {activeCity && (
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

        <div className="generation-loader-title-bar generation-loader-shimmer-block" aria-hidden="true" />

        {DAY_STOP_COUNTS.map((stopCount, dayIndex) => (
          <section key={dayIndex} className="generation-loader-day" aria-hidden="true">
            <div className="generation-loader-day-label generation-loader-shimmer-block" />
            <div className="generation-loader-stops">
              {Array.from({ length: stopCount }, (_, stopIndex) => (
                <div
                  key={stopIndex}
                  className="generation-loader-stop generation-loader-shimmer-block"
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
