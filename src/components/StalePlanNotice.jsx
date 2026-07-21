/** Banner when plan inputs changed after the last generation. */
import GoldSpinner from "./GoldSpinner.jsx";

export default function StalePlanNotice({ onRegenerate, loading = false }) {
  return (
    <div className="stale-plan-notice" role="status">
      <div className="stale-plan-notice-text">
        Your route or preferences changed — results below are from your last generation and may be outdated.
      </div>
      <button
        type="button"
        className="stale-plan-notice-btn"
        onClick={onRegenerate}
        disabled={loading}
      >
        {loading ? <GoldSpinner size="button" /> : "Regenerate trip"}
      </button>
    </div>
  );
}
