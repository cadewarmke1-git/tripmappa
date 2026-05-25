import { useMemo } from "react";
import BudgetCard from "../BudgetCard.jsx";
import { parseTravelerCount } from "../../lib/vehicles.js";
import { computeBudgetEstimate } from "../../lib/budget.js";

export default function TripSummaryFooter({ answers, routeInfo, tripLegs, roadStops, selectedLodging, onShare }) {
  const est = useMemo(
    () => computeBudgetEstimate(answers, routeInfo, tripLegs, { roadStops, selectedLodging }),
    [answers, routeInfo, tripLegs, roadStops, selectedLodging],
  );
  const partySize = parseTravelerCount(answers?.travelers) ?? 1;
  const perPerson = est.total != null && partySize > 0 ? Math.round(est.total / partySize) : null;

  return (
    <footer className="trip-summary-footer">
      <h2 className="trip-summary-title">Trip Summary</h2>
      <BudgetCard
        answers={answers}
        routeInfo={routeInfo}
        tripLegs={tripLegs}
        roadStops={roadStops}
        selectedLodging={selectedLodging}
      />
      {perPerson != null && partySize > 1 && (
        <p className="trip-summary-per-person">About ${perPerson.toLocaleString()} per person ({partySize} travelers)</p>
      )}
      <button type="button" className="btn-generate trip-summary-share-btn" onClick={onShare}>
        Share My Trip
      </button>
    </footer>
  );
}
