import {
  isTruckerTrip,
  isRvTrip,
  hasFamilyKids,
  hasPref,
  skipLodgingQuestion,
} from "../lib/vehicles.js";
import { useMemo, Fragment } from "react";
import { parseMilesFromDistance } from "../lib/parsing.js";
import { buildFuelIntervalPoints, getFuelStopMode, computeSegmentMiles, fuelStopToRoadStop } from "../lib/fuel.js";
import BudgetCard from "./BudgetCard.jsx";
import LodgingCardsSection from "./lodging/LodgingCardsSection.jsx";
import FuelStopsRow from "./fuel/FuelStopsRow.jsx";
import FuelStopsSection from "./fuel/FuelStopsSection.jsx";

export default function StopsResults({
  showHeader = true,
  origin,
  dest,
  answers,
  stops,
  roadStops,
  tripTips,
  stopCategory,
  routeInfo,
  tripLegs,
  onStopCategoryChange,
  truckSafety,
  rvSafety,
  hosCompliance,
  onResetPlan,
  onSaveTrip,
  onToast,
  onToastGold,
  onGroceryModal,
  onAddFuelStop,
  onRemoveRoadStop,
  onLodgingSelect,
  selectedLodging = [],
  stopsEndRef,
}) {
  const isDayOrHomeTrip = skipLodgingQuestion(answers.trip_type, answers.vehicle);
  const isTruckerResults = isTruckerTrip(answers);
  const isRvResults = isRvTrip(answers);
  const wantsRestaurants = hasPref(answers, "Sit down restaurants only")
    || hasPref(answers, "Kid friendly restaurants")
    || hasPref(answers, "Fast food only");
  const fuelMode = getFuelStopMode(answers);
  const totalMiles = parseMilesFromDistance(routeInfo?.distance);

  const fuelIntervalPoints = useMemo(() => {
    if (!routeInfo?.routePoints?.length || fuelMode === "none") return [];
    return buildFuelIntervalPoints(routeInfo.routePoints, stops.length, totalMiles, answers);
  }, [routeInfo?.routePoints, stops.length, totalMiles, answers, fuelMode]);

  function handleAddFuelStop(stop, type) {
    onAddFuelStop?.(fuelStopToRoadStop(stop, type));
    onToast(`Added ${stop.name} to your trip`);
  }

  function renderFuelRow(point, index) {
    if (!point) return null;
    const miles = computeSegmentMiles(totalMiles, point.segmentIndex ?? index, fuelIntervalPoints.length);
    const label = point.required
      ? `Required charge · ~${miles ?? "—"} mi from start`
      : miles != null
        ? `Fuel stop · ~${miles} mi from start`
        : "Fuel stop along route";
    return (
      <FuelStopsRow
        key={`fuel-row-${index}-${point.lat}`}
        point={point}
        answers={answers}
        segmentLabel={label}
        onAddStop={handleAddFuelStop}
        onToast={onToast}
      />
    );
  }

  return (
    <div className="results-view">
      {showHeader && (
        <>
          <div className="results-header">
            <button type="button" className="results-back" onClick={onResetPlan}>← Start over</button>
            <div className="results-route">{origin} → {dest}</div>
            <button type="button" className="results-save" onClick={onSaveTrip}>Save</button>
          </div>
          <div className="results-header-divider"/>
        </>
      )}

      <BudgetCard
        answers={answers}
        routeInfo={routeInfo}
        tripLegs={tripLegs}
        roadStops={roadStops}
        selectedLodging={selectedLodging}
      />

      {showHeader && isTruckerResults && (truckSafety || hosCompliance) && (
        <>
          {hosCompliance && (
            <div className="hos-compliance-card">
              <div className="hos-shield">HOS</div>
              <div>
                <div className="hos-title">HOS Compliant Route</div>
                <div className="hos-detail">
                  {hosCompliance.drivingDays} driving day{hosCompliance.drivingDays > 1 ? "s" : ""}, {hosCompliance.overnightStopsRequired} overnight stop{hosCompliance.overnightStopsRequired !== 1 ? "s" : ""} required by federal law
                </div>
                {hosCompliance.forcedStopNote && <div className="hos-warning">{hosCompliance.forcedStopNote}</div>}
              </div>
            </div>
          )}
          {truckSafety && (
            <div className="truck-safety-card">
              <div className="truck-safety-title">Route safety summary</div>
              <div className="truck-safety-row">Weigh stations on route: <strong>{truckSafety.weighStations}</strong></div>
              {truckSafety.lowBridges?.map((b, i) => (
                <div className="truck-safety-warn" key={`bridge-${i}`}>Low bridge: {b.name} — {b.clearance} at {b.location}</div>
              ))}
              {truckSafety.steepGrades?.map((g, i) => (
                <div className="truck-safety-warn" key={`grade-${i}`}>Steep grade ahead — {g.grade} at {g.location}. Reduce speed.</div>
              ))}
              {truckSafety.estimatedFuelGal && (
                <div className="truck-safety-row">Est. diesel needed: <strong>{truckSafety.estimatedFuelGal} gal</strong> (6 MPG)</div>
              )}
            </div>
          )}
        </>
      )}

      {showHeader && isRvResults && rvSafety && (
        <div className="rv-safety-card">
          <div className="rv-safety-title">RV route safety summary</div>
          <div className="rv-safety-row">Low bridge warnings: <strong>{rvSafety.lowBridges?.length || 0}</strong></div>
          {rvSafety.lowBridges?.map((b, i) => (
            <div className="rv-safety-warn" key={`rv-bridge-${i}`}>Low bridge: {b.clearance} clearance at {b.location}</div>
          ))}
          {rvSafety.steepGrades?.map((g, i) => (
            <div className="rv-safety-warn" key={`rv-grade-${i}`}>Steep grade — {g.grade} at {g.location}. {g.note}</div>
          ))}
          {rvSafety.sharpCurves?.map((c, i) => (
            <div className="rv-safety-warn" key={`rv-curve-${i}`}>{c.note} — {c.location}</div>
          ))}
          {rvSafety.estimatedFuelGal && (
            <div className="rv-safety-row">Est. fuel needed: <strong>{rvSafety.estimatedFuelGal} gal</strong> (9 MPG avg)</div>
          )}
          {rvSafety.propaneLocations?.length > 0 && (
            <div className="rv-safety-row">Propane refill: {rvSafety.propaneLocations.map(p => p.name).join(", ")}</div>
          )}
          {rvSafety.dumpStations?.length > 0 && (
            <div className="rv-safety-row">Dump stations: {rvSafety.dumpStations.map(d => d.name).join(" · ")}</div>
          )}
        </div>
      )}

      {showHeader && isRvResults && answers.rv_towing === "Yes" && (
        <div className="towing-note-banner">
          Towing a vehicle — extra length restrictions applied. Unhitch zones and oversized parking flagged at destinations. Check state towing speed limits along your route.
        </div>
      )}

      {showHeader && hasFamilyKids(answers.travelers) && (
        <div className="traveler-note-banner">Rest stops suggested every 2 hours for young travelers</div>
      )}

      {roadStops.length > 0 && (
        <>
          <div className="stops-section-label">
            {isRvResults ? "Stops along the way" : isDayOrHomeTrip ? "Stops along the way" : isTruckerResults ? "Road stops" : "Road stops"}
          </div>
          <div className="filter-tabs">
            {["all", "food", "rest", "charging"].filter(cat =>
              cat === "all" || roadStops.some(s => s.category === cat)
            ).map(cat => (
              <button key={cat} type="button" onClick={() => onStopCategoryChange(cat)} className={`filter-tab${stopCategory === cat ? " active" : ""}`}>
                {cat === "all" ? "All" : cat === "food" ? "Food" : cat === "rest" ? "Rest" : "Charging"}
              </button>
            ))}
          </div>
          {roadStops
            .filter(s => stopCategory === "all" || s.category === stopCategory)
            .filter(s => s.category !== "fuel" || fuelMode === "none")
            .map((s, i) => (
              <div key={s.id || `road-${i}`} className="stop-card road-stop-card" style={{ animationDelay: i * 0.07 + "s" }}>
                <div className="road-stop-row">
                  <div className={`road-cat-badge cat-${s.category}`}>
                    {s.category === "fuel" ? "FUEL" : s.category === "food" ? "FOOD" : s.category === "charging" ? "EV" : "REST"}
                  </div>
                  <div className="road-stop-info">
                    <div className="road-stop-name">
                      {s.name}
                      {s.kidFriendly && <span className="mini-badge kid-badge">Kid-friendly</span>}
                      {s.diesel && <span className="mini-badge diesel-badge">{s.diesel}</span>}
                      {s.highClearance && <span className="mini-badge high-clearance-badge">High clearance</span>}
                      {s.rvFriendly && <span className="mini-badge kid-badge">RV-friendly</span>}
                      {s.fuel && <span className="mini-badge diesel-badge">{s.fuel}</span>}
                    </div>
                    <div className="road-stop-loc">{s.location} · {s.distance}</div>
                    {s.amenities && <div className="road-stop-note">{s.amenities}</div>}
                    {s.note && <div className="road-stop-note">{s.note}</div>}
                    {s.scenic && <div className="road-stop-note scenic-note">Scenic viewpoint nearby</div>}
                    {s.petRelief && <div className="road-stop-note">Pet relief area</div>}
                  </div>
                  <div className="road-stop-eta">{s.eta}</div>
                </div>
                <div className="stop-card-actions">
                  {s.userAdded && onRemoveRoadStop && (
                    <button type="button" className="action-btn action-btn-danger" onClick={() => onRemoveRoadStop(s.id ?? i)}>Remove</button>
                  )}
                  {!s.userAdded && (
                    <button type="button" className="action-btn action-btn-primary" onClick={() => onToast("Added to route!")}>Add to route</button>
                  )}
                  {isTruckerResults && s.category === "fuel" && (
                    <button type="button" className="action-btn action-btn-gold" onClick={() => onToastGold("Parking reservation coming in Phase 9 — we'll notify you when live.")}>Reserve Parking</button>
                  )}
                  <button type="button" className="action-btn" onClick={() => onToast("Stop added to map")}>Map</button>
                </div>
              </div>
            ))
          }
        </>
      )}

      {stops.length === 0 && fuelMode !== "none" && (
        <FuelStopsSection
          answers={answers}
          routeInfo={routeInfo}
          stops={stops}
          onAddFuelStop={onAddFuelStop}
          onToast={onToast}
        />
      )}

      {stops.length > 0 && (!isDayOrHomeTrip || isTruckerResults || isRvResults) && (
        <>
          {fuelMode !== "none" && fuelIntervalPoints[0] && (
            <div className="fuel-between-stops">
              <div className="stops-section-label">Fuel &amp; charging along route</div>
              {renderFuelRow(fuelIntervalPoints[0], 0)}
            </div>
          )}
          <div className="filter-tabs" style={{ marginTop: roadStops.length > 0 ? 16 : 0 }}>
            {["all", "hotel", "food"].filter(cat =>
              cat === "all"
              || (cat === "hotel")
              || (cat === "food" && stops.some(s => s.restaurants?.length > 0))
            ).map(cat => (
              <button key={cat} type="button" onClick={() => onStopCategoryChange(cat)} className={`filter-tab${stopCategory === cat ? " active" : ""}`}>
                {cat === "all" ? "All" : cat === "hotel" ? (isRvResults ? "RV Parks" : isTruckerResults ? "Truck Stops" : "Hotels") : "Dining"}
              </button>
            ))}
          </div>
          {stops.map((stop, i) => (
            <Fragment key={`stop-${i}`}>
            <div className="stop-card" style={{ animationDelay: i * 0.07 + "s" }}>
              <div className="stop-card-head">
                <div className="stop-pin"/>
                <div style={{ flex: 1 }}>
                  <div className="stop-city">{stop.city}</div>
                  <div className="stop-meta">{stop.distance} · {stop.eta} drive</div>
                  {stop.scenicView && <div className="scenic-note">{stop.scenicView}</div>}
                </div>
                {stop.why && <div className="stop-why">{stop.why}</div>}
              </div>

              {(stopCategory === "all" || stopCategory === "hotel") && (
                <LodgingCardsSection
                  city={stop.city}
                  answers={answers}
                  origin={origin}
                  dest={dest}
                  selectedLodging={selectedLodging}
                  onLodgingSelect={onLodgingSelect}
                  onToast={onToast}
                />
              )}
              {!isTruckerResults && !isRvResults && (stopCategory === "all" || stopCategory === "food") && wantsRestaurants && stop.restaurants?.length > 0 && (
                <div className="stop-section">
                  <div className="stop-section-head"><span className="badge badge-food">FOOD</span> Dining</div>
                  {stop.restaurants.map((r, ri) => (
                    <div className="item-row" key={ri} onClick={() => onToast(`Booking ${r.name}`)}>
                      <div className="item-info">
                        <div className="item-name">{r.name} {hasFamilyKids(answers.travelers) && <span className="mini-badge kid-badge">Kids menu</span>}</div>
                        <div className="item-meta">{r.cuisine} · {r.rating} stars</div>
                      </div>
                      <div className="item-time">{r.time}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="stop-card-actions">
                {hasPref(answers, "Grocery delivery to hotel") && !isTruckerResults && !isRvResults && (
                  <button type="button" className="action-btn" onClick={() => onGroceryModal(stop.city)}>Grocery</button>
                )}
                <button type="button" className="action-btn" onClick={() => onToast("Stop added to map")}>Map</button>
              </div>
            </div>
            {fuelMode !== "none" && fuelIntervalPoints[i + 1] && (
              <div className="fuel-between-stops">
                {renderFuelRow(fuelIntervalPoints[i + 1], i + 1)}
              </div>
            )}
            </Fragment>
          ))}
        </>
      )}

      {tripTips.length > 0 && (
        <div className="tips-card">
          <div className="stops-section-label">Trip tips</div>
          {tripTips.map((tip, i) => (
            <div key={i} className="tip-row">
              <span className="tip-arrow">→</span>
              <span>{tip}</span>
            </div>
          ))}
        </div>
      )}
      <div ref={stopsEndRef}/>
    </div>
  );
}
