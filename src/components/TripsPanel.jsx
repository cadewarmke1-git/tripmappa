function shortCity(value) {
  if (!value) return "";
  return value.split(",")[0].trim();
}

function formatTripDate(date) {
  if (!date) return "";
  return date;
}

export default function TripsPanel({ savedTrips, onViewTrip, onDeleteTrip, onPlanTrip }) {
  return (
    <div className="trips-panel">
      <div className="trips-panel-head">
        <h2 className="trips-panel-title">Trips</h2>
        <p className="trips-panel-sub">Saved routes you can reopen anytime.</p>
      </div>

      {savedTrips.length > 0 ? (
        <ul className="trips-saved-list">
          {savedTrips.map(trip => {
            const stopCount = trip.stops?.length || 0;
            const from = shortCity(trip.origin);
            const to = shortCity(trip.dest);
            return (
              <li key={trip.id} className="trips-saved-card">
                <div className="trips-saved-card-route">
                  <span className="trips-saved-card-city">{from || "Origin"}</span>
                  <span className="trips-saved-card-arrow" aria-hidden="true">→</span>
                  <span className="trips-saved-card-city">{to || "Destination"}</span>
                </div>
                <div className="trips-saved-card-meta">
                  {formatTripDate(trip.date) && <span>{formatTripDate(trip.date)}</span>}
                  <span>{stopCount} stop{stopCount !== 1 ? "s" : ""}</span>
                  {trip.routeInfo?.distance && <span>{trip.routeInfo.distance}</span>}
                </div>
                <div className="trips-saved-card-actions">
                  <button type="button" className="trips-saved-btn trips-saved-btn-primary" onClick={() => onViewTrip(trip)}>
                    View trip
                  </button>
                  <button type="button" className="trips-saved-btn trips-saved-btn-danger" onClick={() => onDeleteTrip(trip.id)}>
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="trips-empty-state">
          <div className="trips-empty-mark" aria-hidden="true">TM</div>
          <div className="trips-empty-title">No saved trips yet</div>
          <p className="trips-empty-sub">Plan a trip and sign in to save it here for later.</p>
          <button type="button" className="trips-empty-cta" onClick={onPlanTrip}>Plan a trip</button>
        </div>
      )}
    </div>
  );
}
