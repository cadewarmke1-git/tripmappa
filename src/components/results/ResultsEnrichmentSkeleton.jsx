import GoldSpinner from "../GoldSpinner.jsx";

/** Route loader while trip enrichment fetches Google Places data. */
export default function ResultsEnrichmentSkeleton({ theme = "night" }) {
  return (
    <section className="results-enrichment-loader" aria-busy="true" aria-label="Loading trip details">
      <GoldSpinner size="lg" />
    </section>
  );
}
