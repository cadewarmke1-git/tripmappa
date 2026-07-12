import { useMemo, useState } from "react";
import SearchBarAnimated from "./SearchBarAnimated.jsx";
import RouteMapThumbnail from "./RouteMapThumbnail.jsx";

function shortCity(value) {
  if (!value) return "";
  return value.split(",")[0].trim();
}

function formatTripDate(date) {
  if (!date) return "";
  return date;
}

function tripRouteName(trip) {
  const from = shortCity(trip.origin);
  const to = shortCity(trip.dest);
  if (from && to) return `${from} → ${to}`;
  return trip.origin || trip.dest || "Saved route";
}

function tripStopCount(trip) {
  return (trip.stops?.length || 0) + (trip.roadStops?.length || 0);
}

function tripMatchesFilter(trip, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    trip.origin,
    trip.dest,
    shortCity(trip.origin),
    shortCity(trip.dest),
    trip.date,
    trip.routeInfo?.distance,
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(q);
}

export default function TripsPanel({ savedTrips, onViewTrip, onDeleteTrip, onPlanTrip }) {
  const [filterQuery, setFilterQuery] = useState("");

  const filteredTrips = useMemo(
    () => savedTrips.filter(trip => tripMatchesFilter(trip, filterQuery)),
    [savedTrips, filterQuery],
  );

  return (
    <div className="trips-panel">
      <div className="trips-panel-head">
        <h2 className="trips-panel-title">Trips</h2>
        <p className="trips-panel-sub">Your trip history — resume any route without regenerating.</p>
        {savedTrips.length > 0 && (
          <div className="trips-panel-filter">
            <SearchBarAnimated
              value={filterQuery}
              onChange={setFilterQuery}
              placeholder="Filter trips…"
              ariaLabel="Filter saved trips"
            />
          </div>
        )}
      </div>

      {savedTrips.length > 0 ? (
        filteredTrips.length > 0 ? (
        <ul className="trips-saved-list">
          {filteredTrips.map(trip => {
            const stopCount = tripStopCount(trip);
            const routeName = tripRouteName(trip);
            return (
              <li key={trip.id} className="trips-saved-card">
                <RouteMapThumbnail routePoints={trip.routeInfo?.routePoints} className="trips-saved-card-thumb" />
                <div className="trips-saved-card-body">
                  <div className="trips-saved-card-route">
                    <span className="trips-saved-card-name">{routeName}</span>
                  </div>
                  <div className="trips-saved-card-meta">
                    {formatTripDate(trip.date) && <span>{formatTripDate(trip.date)}</span>}
                    <span>{stopCount} stop{stopCount !== 1 ? "s" : ""}</span>
                    {trip.routeInfo?.distance && <span>{trip.routeInfo.distance}</span>}
                  </div>
                  <div className="trips-saved-card-actions">
                    <button type="button" className="trips-saved-btn trips-saved-btn-primary" onClick={() => onViewTrip(trip)}>
                      Resume trip
                    </button>
                    <button type="button" className="trips-saved-btn trips-saved-btn-danger" onClick={() => onDeleteTrip(trip.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        ) : (
          <div className="trips-empty-state">
            <div className="trips-empty-title">No trips match your filter</div>
            <p className="trips-empty-sub">Try a different city name or clear the search.</p>
          </div>
        )
      ) : (
        <div className="trips-empty-state">
          <div className="trips-empty-mark" aria-hidden="true">TM</div>
          <div className="trips-empty-title">No saved trips yet</div>
          <p className="trips-empty-sub">Plan a trip from the home screen — saved routes will show up here.</p>
          <button type="button" className="trips-empty-cta" onClick={onPlanTrip}>Plan a trip</button>
        </div>
      )}
    </div>
  );
}
