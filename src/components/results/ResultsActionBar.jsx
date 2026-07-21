import { useState } from "react";

export default function ResultsActionBar({ onStartNavigation, onShare, onEditTrip }) {
  const [navClicked, setNavClicked] = useState(false);

  function handleStartNavigation() {
    setNavClicked(true);
    onStartNavigation?.();
  }

  return (
    <footer className="results-action-bar" aria-label="Trip actions">
      <button
        type="button"
        className={`results-action-bar-primary btn-generate${navClicked ? "" : " results-nav-pulse"}`}
        onClick={handleStartNavigation}
        data-testid="results-start-navigation"
      >
        Start navigation
      </button>
      <button
        type="button"
        className="results-action-bar-secondary results-action-bar-tool"
        onClick={onShare}
        aria-label="Share trip"
      >
        <svg className="results-action-bar-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 16V4m0 0 4 4m-4-4-4 4M6 20h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="results-action-bar-tool-label">Share</span>
      </button>
      <button
        type="button"
        className="results-action-bar-secondary results-action-bar-tool"
        onClick={onEditTrip}
        aria-label="Edit trip"
      >
        <svg className="results-action-bar-tool-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0 0-3L16.5 4.5a2.1 2.1 0 0 0-3 0L3 15v5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="results-action-bar-tool-label">Edit trip</span>
      </button>
    </footer>
  );
}
