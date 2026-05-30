/** Banner when plan inputs changed after the last generation. */
import RouteDrawingLoader from "./RouteDrawingLoader.jsx";

export default function StalePlanNotice({ onRegenerate, loading = false, changes = [] }) {
  return (
    <div className="stale-plan-notice" role="status">
      <div className="stale-plan-notice-text">
        Your route or preferences changed — results below are from your last generation and may be outdated.
        {changes.length > 0 && (
          <ul className="stale-plan-changes">
            {changes.map(line => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        className="stale-plan-notice-btn"
        onClick={onRegenerate}
        disabled={loading}
      >
        {loading ? <RouteDrawingLoader variant="button" /> : "Regenerate trip"}
      </button>
    </div>
  );
}
