/** Inline notice when Google Places enrichment is partial or unavailable. */
export default function EnrichmentNotice({ limited = false, onDismiss }) {
  if (!limited) return null;

  return (
    <div className="enrichment-notice" role="status">
      <p className="enrichment-notice-text">
        Some photos and place details may be unavailable — your trip is still complete.
      </p>
      {onDismiss && (
        <button type="button" className="enrichment-notice-dismiss" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}
