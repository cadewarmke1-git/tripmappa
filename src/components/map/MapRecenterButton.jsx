/** Frosted glass Recenter button — fits entire route in view. */
export default function MapRecenterButton({ onRecenter }) {
  return (
    <button type="button" className="map-recenter-btn" onClick={onRecenter} aria-label="Recenter map on route">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8"/>
        <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
      Recenter
    </button>
  );
}
