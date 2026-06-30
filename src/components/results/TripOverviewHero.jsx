import { useMemo } from "react";
import { computeBudgetEstimate } from "../../lib/budget.js";
import { getItineraryOverview } from "../../lib/itineraryDays.js";

export default function TripOverviewHero({ origin, dest, routeInfo, stops, roadStops, answers, tripLegs, selectedLodging, restaurantsByCity = {}, routeOptimized = false, waypoints = null }) {
  const budget = useMemo(
    () => computeBudgetEstimate(answers, routeInfo, tripLegs, { roadStops, selectedLodging, restaurantsByCity }),
    [answers, routeInfo, tripLegs, roadStops, selectedLodging, restaurantsByCity],
  );

  const overview = getItineraryOverview({
    origin, dest, routeInfo, stops, roadStops, budgetTotal: budget.total, waypoints,
  });

  return (
    <header className="trip-overview-hero">
      <div className="trip-overview-hero-accent" aria-hidden="true"/>
      {routeOptimized && (
        <div className="trip-route-optimized-notice" role="status">
          Overnight stops were reordered for a shorter drive — review each day before you go.
        </div>
      )}
      <p className="trip-overview-hero-eyebrow">Your route is ready</p>
      <p className="trip-overview-hero-ready-line" role="status">
        Route mapped · {overview.stopCount} stops planned · Ready to drive
      </p>
      <h1 className="trip-overview-hero-title">{overview.tripName}</h1>
      <div className="trip-overview-hero-stats">
        <div className="trip-overview-hero-stat">
          <span className="trip-overview-hero-val">{overview.distance}</span>
          <span className="trip-overview-hero-label">Distance</span>
        </div>
        <div className="trip-overview-hero-stat">
          <span className="trip-overview-hero-val">{overview.duration}</span>
          <span className="trip-overview-hero-label">Drive time</span>
        </div>
        <div className="trip-overview-hero-stat">
          <span className="trip-overview-hero-val">{overview.dayCount}</span>
          <span className="trip-overview-hero-label">Days</span>
        </div>
        <div className="trip-overview-hero-stat">
          <span className="trip-overview-hero-val">{overview.stopCount}</span>
          <span className="trip-overview-hero-label">Stops</span>
        </div>
        {overview.estimatedCost != null && (
          <div className="trip-overview-hero-stat trip-overview-hero-stat-gold">
            <span className="trip-overview-hero-val">${Math.round(overview.estimatedCost).toLocaleString()}</span>
            <span className="trip-overview-hero-label">Est. cost</span>
          </div>
        )}
      </div>
    </header>
  );
}
