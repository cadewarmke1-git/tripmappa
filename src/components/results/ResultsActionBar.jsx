export default function ResultsActionBar({ onStartNavigation, onShare, onEditTrip }) {
  return (
    <footer className="results-action-bar" aria-label="Trip actions">
      <button
        type="button"
        className="results-action-bar-primary btn-generate"
        onClick={onStartNavigation}
        data-testid="results-start-navigation"
      >
        Start navigation
      </button>
      <button type="button" className="results-action-bar-secondary" onClick={onShare}>
        Share
      </button>
      <button type="button" className="results-action-bar-secondary" onClick={onEditTrip}>
        Edit
      </button>
    </footer>
  );
}
