/** Real-time generation progress overlay during SSE streaming. */
import RouteDrawingLoader from "./RouteDrawingLoader.jsx";

export default function GenerationStreamOverlay({ progress, theme }) {
  if (!progress) return null;

  const previewStops = [
    ...(progress.cityNames || []),
    ...(progress.stopNames || []),
  ].filter(Boolean);

  const legMessage = progress.totalSegments > 1
    ? progress.message
    : (progress.message || "Planning your route…");

  return (
    <div className="generation-stream-overlay" aria-live="polite" aria-busy="true">
      <RouteDrawingLoader theme={theme} variant="inline" />
      {progress.totalSegments > 1 && (
        <p className="generation-stream-leg">
          Leg {Math.min((progress.completedSegments || progress.segmentIndex + 1 || 1), progress.totalSegments)} of {progress.totalSegments}
        </p>
      )}
      <p className="generation-stream-message">{legMessage}</p>
      {progress.routeSummary && (
        <p className="generation-stream-summary">{progress.routeSummary}</p>
      )}
      {previewStops.length > 0 && (
        <ul className="generation-stream-stops">
          {previewStops.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
