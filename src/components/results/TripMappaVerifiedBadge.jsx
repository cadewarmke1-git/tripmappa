export default function TripMappaVerifiedBadge({ className = "" }) {
  return (
    <span
      className={`tripmappa-verified-badge ${className}`.trim()}
      title="Verified on Google Maps — real business with live listing data"
      aria-label="Verified stop from Google Places"
    >
      <span className="tripmappa-verified-badge-icon" aria-hidden="true">✓</span>
      Verified
    </span>
  );
}
