/** Quiet inline progress while Places enrichment runs — brand stays in nav. */
export default function ResultsEnrichmentSkeleton({ theme: _theme = "night", onCancel = null }) {
  return (
    <section className="results-enrichment-loader" aria-busy="true" aria-label="Loading trip details">
      <p className="results-enrichment-loader-label">Filling in nearby places and map details…</p>
      {onCancel && (
        <button type="button" className="enrichment-notice-retry" onClick={onCancel}>
          Cancel
        </button>
      )}
    </section>
  );
}
