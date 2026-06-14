/**
 * GenerationCinematicLoader
 * Loading skeleton shown while trip generation streams.
 */

const DAY_STOP_COUNTS = [3, 2, 3];

export default function GenerationCinematicLoader({
  progress: _progress = 0,
  subtitle: _subtitle = "",
  statusMessage: _statusMessage = "",
  cityBeats: _cityBeats = [],
  destination: _destination = "",
  vehicleType: _vehicleType = "Car",
  skyPhase: _skyPhase = "sunset",
}) {
  return (
    <div className="generation-loader-skeleton" aria-busy="true" aria-label="Generating your trip">
      <div className="generation-loader-skeleton-panel">
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
