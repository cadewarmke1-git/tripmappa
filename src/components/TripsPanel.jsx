import { useMemo, useState } from "react";
import SearchBarAnimated from "./SearchBarAnimated.jsx";
import RouteMapThumbnail from "./RouteMapThumbnail.jsx";
import { getTripVehicle } from "../lib/tripStats.js";
import { getEffectiveVehicle } from "../lib/vehicles.js";

function shortCity(value) {
  if (!value) return "";
  return value.split(",")[0].trim();
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

function collectStopPoints(trip) {
  const fromStops = (trip?.stops || [])
    .filter(s => s?.lat != null && s?.lng != null)
    .map(s => ({ lat: s.lat, lng: s.lng }));
  const fromRoad = (trip?.roadStops || [])
    .filter(s => s?.lat != null && s?.lng != null)
    .map(s => ({ lat: s.lat, lng: s.lng }));
  return [...fromStops, ...fromRoad];
}

function vehicleLabel(answersOrTrip) {
  const raw = typeof answersOrTrip?.answers === "object"
    ? (getEffectiveVehicle(answersOrTrip.answers) || getTripVehicle(answersOrTrip))
    : (getEffectiveVehicle(answersOrTrip || {}) || answersOrTrip?.vehicle);
  if (!raw) return null;
  const dash = String(raw).indexOf("—");
  if (dash > 0) return String(raw).slice(0, dash).trim();
  if (raw === "Semi Truck (18-wheeler)") return "Semi truck";
  return raw;
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
    vehicleLabel(trip),
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(q);
}

function TripMiniCard({
  routeName,
  vehicle,
  stopCount,
  distance,
  routePoints,
  stopPoints,
  badge = null,
  isDraft = false,
  primaryLabel,
  onPrimary,
  onDelete = null,
}) {
  return (
    <li className={`trips-saved-card${isDraft ? " trips-saved-card--draft" : ""}`}>
      <RouteMapThumbnail
        routePoints={routePoints}
        stopPoints={stopPoints}
        className="trips-saved-card-thumb"
      />
      <div className="trips-saved-card-body">
        <div className="trips-saved-card-route">
          {badge && <span className="trips-saved-card-badge">{badge}</span>}
          <span className="trips-saved-card-name">{routeName}</span>
        </div>
        <div className="trips-saved-card-meta">
          {vehicle && <span className="trips-saved-card-vehicle">{vehicle}</span>}
          {stopCount != null && (
            <span>{stopCount} stop{stopCount !== 1 ? "s" : ""}</span>
          )}
          {distance && <span>{distance}</span>}
        </div>
        <div className="trips-saved-card-actions">
          <button type="button" className="trips-saved-btn trips-saved-btn-primary" onClick={onPrimary}>
            {primaryLabel}
          </button>
          {onDelete && (
            <button type="button" className="trips-saved-btn trips-saved-btn-danger" onClick={onDelete}>
              Delete
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export default function TripsPanel({
  savedTrips,
  planDraft = null,
  onViewTrip,
  onDeleteTrip,
  onPlanTrip,
  onResumeDraft,
}) {
  const [filterQuery, setFilterQuery] = useState("");

  const hasDraft = Boolean(planDraft?.origin && planDraft?.dest);
  const draftMatches = hasDraft && tripMatchesFilter(
    { origin: planDraft.origin, dest: planDraft.dest, answers: planDraft.answers },
    filterQuery,
  );

  const filteredTrips = useMemo(
    () => savedTrips.filter(trip => tripMatchesFilter(trip, filterQuery)),
    [savedTrips, filterQuery],
  );

  const hasAnyTrips = hasDraft || savedTrips.length > 0;
  const hasVisible = (draftMatches && hasDraft) || filteredTrips.length > 0;

  return (
    <div className="trips-panel">
      <div className="trips-panel-head">
        <h2 className="trips-panel-title">Trips</h2>
        <p className="trips-panel-sub">Your trip history — resume any route without regenerating.</p>
        {hasAnyTrips && (
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

      {hasAnyTrips ? (
        hasVisible ? (
          <ul className="trips-saved-list trips-saved-list--rail">
            {draftMatches && (
              <TripMiniCard
                key="plan-draft"
                routeName={tripRouteName(planDraft)}
                vehicle={vehicleLabel(planDraft.answers)}
                stopCount={null}
                distance={null}
                routePoints={planDraft.routeInfo?.routePoints || planDraft.routePoints}
                stopPoints={[]}
                badge="Draft"
                isDraft
                primaryLabel="Continue"
                onPrimary={() => onResumeDraft?.()}
              />
            )}
            {filteredTrips.map(trip => {
              const stopCount = tripStopCount(trip);
              return (
                <TripMiniCard
                  key={trip.id}
                  routeName={tripRouteName(trip)}
                  vehicle={vehicleLabel(trip)}
                  stopCount={stopCount}
                  distance={trip.routeInfo?.distance || null}
                  routePoints={trip.routeInfo?.routePoints}
                  stopPoints={collectStopPoints(trip)}
                  primaryLabel="Resume trip"
                  onPrimary={() => onViewTrip(trip)}
                  onDelete={() => onDeleteTrip(trip.id)}
                />
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
