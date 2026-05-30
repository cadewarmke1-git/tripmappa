/** Prominent control to return from fullscreen map to trip output. */
export default function MapBackToTripButton({ onBack }) {
  return (
    <button
      type="button"
      className="map-back-to-trip-btn"
      onClick={onBack}
      aria-label="Back to trip details"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Back to Trip
    </button>
  );
}
