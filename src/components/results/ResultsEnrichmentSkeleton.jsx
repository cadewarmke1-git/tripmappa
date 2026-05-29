/** Skeleton placeholders while trip enrichment loads Google Places data. */
export default function ResultsEnrichmentSkeleton({ label = "Loading stops and dining from Google Places…" }) {
  return (
    <section className="results-enrichment-skeleton" aria-busy="true" aria-label="Loading trip details">
      <p className="results-enrichment-skeleton-label">{label}</p>
      <div className="results-enrichment-skeleton-cards">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="results-enrichment-skeleton-card">
            <div className="results-enrichment-skeleton-photo shimmer-block" />
            <div className="results-enrichment-skeleton-line shimmer-block" />
            <div className="results-enrichment-skeleton-line short shimmer-block" />
          </div>
        ))}
      </div>
    </section>
  );
}
