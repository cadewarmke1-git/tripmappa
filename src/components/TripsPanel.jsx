export default function TripsPanel({ savedTrips, onViewTrip, onDeleteTrip, onPlanTrip }) {
  return (
    <div className="stops-wrap">
      <div className="stops-panel-head">
        <h2 className="stops-panel-title">Trips</h2>
        <p className="stops-panel-sub">Your saved trips will appear here.</p>
      </div>
      {savedTrips.length > 0 ? (
        savedTrips.map(trip => (
          <div key={trip.id} className="stop-card" style={{ marginBottom: 10 }}>
            <div className="stop-card-head">
              <div style={{ flex: 1 }}>
                <div className="stop-city">{trip.origin} → {trip.dest}</div>
                <div className="stop-meta">{trip.date} · {trip.stops?.length || 0} stop{(trip.stops?.length || 0) !== 1 ? "s" : ""} · {trip.routeInfo?.distance || ""}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" className="action-btn" style={{ flex: "none", padding: "4px 10px", fontSize: 11 }} onClick={() => onViewTrip(trip)}>View</button>
                <button type="button" className="action-btn" style={{ flex: "none", padding: "4px 10px", fontSize: 11, color: "var(--danger)", borderColor: "var(--danger)" }} onClick={() => onDeleteTrip(trip.id)}>✕</button>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true">🗺️</div>
          <div className="empty-title">No saved trips yet</div>
          <div className="empty-sub">Your saved trips will appear here. Sign in to save your trips.</div>
          <button type="button" className="empty-cta" onClick={onPlanTrip}>Plan a trip</button>
        </div>
      )}
    </div>
  );
}
