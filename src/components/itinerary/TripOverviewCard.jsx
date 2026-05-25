import { useMemo } from "react";
import { computeBudgetEstimate } from "../../lib/budget.js";
import { getItineraryOverview } from "../../lib/itineraryDays.js";

export default function TripOverviewCard({ origin, dest, routeInfo, stops, answers, tripLegs, roadStops, selectedLodging }) {
  const budget = useMemo(
    () => computeBudgetEstimate(answers, routeInfo, tripLegs, { roadStops, selectedLodging }),
    [answers, routeInfo, tripLegs, roadStops, selectedLodging],
  );

  const overview = getItineraryOverview({
    origin,
    dest,
    routeInfo,
    stops,
    budgetTotal: budget.total,
  });

  return (
    <div className="trip-overview-card">
      <div className="trip-overview-accent" aria-hidden="true"/>
      <div className="trip-overview-route">
        <span className="trip-overview-city">{overview.origin}</span>
        <span className="trip-overview-arrow">→</span>
        <span className="trip-overview-city">{overview.destination}</span>
      </div>
      <div className="trip-overview-stats">
        <div className="trip-overview-stat">
          <span className="trip-overview-stat-val">{overview.distance}</span>
          <span className="trip-overview-stat-label">Distance</span>
        </div>
        <div className="trip-overview-stat">
          <span className="trip-overview-stat-val">{overview.duration}</span>
          <span className="trip-overview-stat-label">Drive time</span>
        </div>
        <div className="trip-overview-stat">
          <span className="trip-overview-stat-val">{overview.overnightCount}</span>
          <span className="trip-overview-stat-label">Overnights</span>
        </div>
        {overview.estimatedCost != null && (
          <div className="trip-overview-stat">
            <span className="trip-overview-stat-val">${Math.round(overview.estimatedCost).toLocaleString()}</span>
            <span className="trip-overview-stat-label">Est. cost</span>
          </div>
        )}
      </div>
    </div>
  );
}
