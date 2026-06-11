export default function TripMappaVerifiedBadge({ className = "" }) {
  return (
    <span className={`tripmappa-verified-badge ${className}`.trim()} title="Verified in TripMappa plan">
      TripMappa verified
    </span>
  );
}
