/** Breathing TripMappa wordmark loader — full loading states only. */
export default function PulsingWordmark({ size = "lg", className = "" }) {
  return (
    <div
      className={`pulsing-wordmark pulsing-wordmark--${size}${className ? ` ${className}` : ""}`}
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <span className="pulsing-wordmark-inner" aria-hidden="true">
        <span className="pulsing-wordmark-trip">Trip</span>
        <span className="pulsing-wordmark-mappa">Mappa</span>
      </span>
    </div>
  );
}
