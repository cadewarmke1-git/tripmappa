const DRIVE_TIME_OPTIONS = [
  { label: "1 hour", seconds: 3600 },
  { label: "2 hours", seconds: 7200 },
  { label: "3 hours", seconds: 10800 },
  { label: "4 hours", seconds: 14400 },
];

export default function HeroExploreRange({
  enabled = false,
  driveTimeSeconds = 7200,
  loading = false,
  error = null,
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
          <span className="hero-explore-range-time-label">Drive time</span>
          <select
            className="hero-explore-range-select"
            value={driveTimeSeconds}
            onChange={(e) => onDriveTimeChange?.(Number(e.target.value))}
            aria-label="Drive time range"
          >
            {DRIVE_TIME_OPTIONS.map(opt => (
              <option key={opt.seconds} value={opt.seconds}>{opt.label}</option>
            ))}
          </select>
          {loading && <span className="hero-explore-range-status">Loading range...</span>}
          {!loading && error && <span className="hero-explore-range-error">{error}</span>}
        </div>
      )}
    </div>
  );
}

export { DRIVE_TIME_OPTIONS };
