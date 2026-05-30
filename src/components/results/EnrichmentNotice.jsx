/** Inline notice when Google Places enrichment is partial, in progress, or unavailable. */
export default function EnrichmentNotice({
  limited = false,
  enriching = false,
  onDismiss,
  onRetry,
  onCancel,
}) {
  if (enriching) {
    return (
      <div className="enrichment-notice enrichment-notice-active" role="status" aria-live="polite">
        <p className="enrichment-notice-text">Loading nearby places, restaurants, and map details…</p>
        {onCancel && (
          <div className="enrichment-notice-actions">
            <button type="button" className="enrichment-notice-retry" onClick={onCancel}>
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!limited) return null;

  return (
    <div className="enrichment-notice" role="status">
      <p className="enrichment-notice-text">
        Some photos and place details may be unavailable — your trip is still usable.
      </p>
      <div className="enrichment-notice-actions">
        {onRetry && (
          <button type="button" className="enrichment-notice-retry" onClick={onRetry}>
            Retry
          </button>
        )}
        {onDismiss && (
          <button type="button" className="enrichment-notice-dismiss" onClick={onDismiss} aria-label="Dismiss">
            ×
          </button>
        )}
      </div>
    </div>
  );
}
