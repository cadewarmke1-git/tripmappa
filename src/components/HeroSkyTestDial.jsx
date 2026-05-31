import { formatSkyHour } from "../lib/skyTime.js";

const PHASE_LABELS = {
  pre_dawn: "Pre-dawn",
  sunrise: "Sunrise",
  midday: "Midday",
  golden_hour: "Golden hour",
  dusk: "Dusk",
  night: "Night",
};

/** Temporary — always visible until launch; scrub local time to preview animated sky. */
export default function HeroSkyTestDial({
  hour,
  liveHour,
  phase,
  isOverridden,
  isUrlLocked,
  onHourChange,
  onResetLive,
}) {
  return (
    <div className="hero-sky-test-dial" aria-label="Sky animation test dial">
      <div className="hero-sky-test-dial-header">
        <div className="hero-sky-test-dial-title-row">
          <span className="hero-sky-test-dial-label">Sky test</span>
          {isOverridden && !isUrlLocked && (
            <button type="button" className="hero-sky-test-dial-live-btn" onClick={onResetLive}>
              Back to live ({formatSkyHour(liveHour)})
            </button>
          )}
          {isUrlLocked && (
            <span className="hero-sky-test-dial-locked">URL locked</span>
          )}
        </div>
        <span className="hero-sky-test-dial-meta">
          {formatSkyHour(hour)} · {PHASE_LABELS[phase] || phase}
        </span>
      </div>
      <input
        type="range"
        className="hero-sky-test-dial-range"
        min={0}
        max={24}
        step={0.25}
        value={hour}
        disabled={isUrlLocked}
        onChange={e => onHourChange(Number(e.target.value))}
        aria-valuetext={`${formatSkyHour(hour)}, ${PHASE_LABELS[phase] || phase}`}
      />
      <div className="hero-sky-test-dial-ticks" aria-hidden="true">
        <span>12am</span>
        <span>6am</span>
        <span>12pm</span>
        <span>6pm</span>
        <span>12am</span>
      </div>
    </div>
  );
}
