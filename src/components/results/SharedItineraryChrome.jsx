/** Branded header/footer for read-only shared itinerary links. */
export function SharedItineraryHeader({ origin, dest }) {
  const routeLabel = [origin, dest].filter(Boolean).join(" → ");
  return (
    <header className="shared-itinerary-header">
      <div className="shared-itinerary-brand-block">
        <span className="shared-itinerary-wordmark">TripMappa</span>
        <p className="shared-itinerary-tagline">Someone already drove the research lane</p>
      </div>
      {routeLabel && (
        <p className="shared-itinerary-route">{routeLabel}</p>
      )}
    </header>
  );
}

export function SharedItineraryFooter() {
  return (
    <footer className="shared-itinerary-footer">
      <p className="shared-itinerary-footer-copy">
        A verified corridor, real stops, and a plan you can drive — not a list of suggestions to cross-check in Maps.
      </p>
      <a href="/" className="shared-itinerary-cta btn-generate">
        Plan your own trip →
      </a>
      <p className="shared-itinerary-cta-sub">Get your own verified route in seconds</p>
    </footer>
  );
}
