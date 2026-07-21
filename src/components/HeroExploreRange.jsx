const DRIVE_TIME_OPTIONS = [
  { label: "1 hour", seconds: 3600 },
  { label: "2 hours", seconds: 7200 },
  { label: "3 hours", seconds: 10800 },
  { label: "4 hours", seconds: 14400 },
];

export default function HeroExploreRange({
  enabled = false,
  driveTimeSeconds = 7200,
  hasRoute = false,
  corridorStops = [],
  statusMessage = null,
  onToggle,
  onDriveTimeChange,
}) {
  return (
    <div className="hero-explore-range">
      <label className="hero-explore-range-toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle?.(e.target.checked)}
        />
        <span className="hero-explore-range-toggle-ui" aria-hidden="true" />
        <span className="hero-explore-range-label">Explore range</span>
      </label>
      {enabled && (
        <div className="hero-explore-range-controls">
          {!hasRoute ? (
            <span className="hero-explore-range-error" role="status">
              Plan a trip first to use explore range.
            </span>
          ) : (
            <>
              <span className="hero-explore-range-time-label">Drive time</span>
              <select
                className="hero-explore-range-select"
                value={driveTimeSeconds}
                onChange={(e) => onDriveTimeChange?.(Number(e.target.value))}
                aria-label="Drive time range"
              >
                {DRIVE_TIME_OPTIONS.map((opt) => (
                  <option key={opt.seconds} value={opt.seconds}>{opt.label}</option>
                ))}
              </select>
              {statusMessage && (
                <span className="hero-explore-range-status">{statusMessage}</span>
              )}
              {corridorStops.length > 0 && (
                <ul className="hero-explore-range-stops" aria-label="Stops in range">
                  {corridorStops.slice(0, 6).map((stop) => (
                    <li key={stop.id || stop.name}>{stop.title || stop.name}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export { DRIVE_TIME_OPTIONS };
