import { useMemo, useRef } from "react";
import { isTruckerTrip, isRvTrip } from "../lib/vehicles.js";
import { buildItineraryDays } from "../lib/itineraryDays.js";
import TripOverviewCard from "./itinerary/TripOverviewCard.jsx";
import RouteProgressBar from "./itinerary/RouteProgressBar.jsx";
import ItineraryDaySection from "./itinerary/ItineraryDaySection.jsx";
import TripAlertsBanner from "./TripAlertsSection.jsx";
import FuelStopsSection from "./fuel/FuelStopsSection.jsx";
import { getFuelStopMode } from "../lib/fuel.js";

export default function StopsResults({
  showHeader = true,
  origin,
  dest,
  answers,
  stops,
  roadStops,
  tripTips,
  routeInfo,
  tripLegs,
  onResetPlan,
  onSaveTrip,
  onToast,
  onAddFuelStop,
  onLodgingSelect,
  selectedLodging = [],
  tripAlerts = [],
  onDismissAlert,
  optionalStopCards = [],
  activeDayIndex = 0,
  onDaySelect,
  onFocusMap,
  onAddRoadStop,
  departureTime,
  stopsEndRef,
}) {
  const dayRefs = useRef([]);
  const isTruckerResults = isTruckerTrip(answers);
  const isRvResults = isRvTrip(answers);
  const fuelMode = getFuelStopMode(answers);

  const days = useMemo(() => buildItineraryDays({
    origin,
    dest,
    stops,
    roadStops,
    routeInfo,
    optionalStopCards,
    departureTime,
  }), [origin, dest, stops, roadStops, routeInfo, optionalStopCards, departureTime]);

  function scrollToDay(index) {
    onDaySelect?.(index);
    dayRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleAddRoadStop(item) {
    onAddRoadStop?.(item);
    onToast?.(`Added ${item.name || item.title} to your trip`);
  }

  return (
    <div className="results-view itinerary-view">
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

      <TripOverviewCard
        origin={origin}
        dest={dest}
        routeInfo={routeInfo}
        stops={stops}
        answers={answers}
        tripLegs={tripLegs}
        roadStops={roadStops}
        selectedLodging={selectedLodging}
      />

      <RouteProgressBar days={days} activeDayIndex={activeDayIndex} onDaySelect={scrollToDay} />

      <TripAlertsBanner alerts={tripAlerts} onDismiss={onDismissAlert} />

      {days.map((day, i) => (
        <ItineraryDaySection
          key={day.dayNumber}
          day={day}
          answers={answers}
          origin={origin}
          dest={dest}
          routeInfo={routeInfo}
          selectedLodging={selectedLodging}
          onLodgingSelect={onLodgingSelect}
          onToast={onToast}
          onFocusMap={onFocusMap}
          onAddRoadStop={handleAddRoadStop}
          isTruckerResults={isTruckerResults}
          isRvResults={isRvResults}
          sectionRef={el => { dayRefs.current[i] = el; }}
        />
      ))}

      {stops.length === 0 && fuelMode !== "none" && (
        <FuelStopsSection
          answers={answers}
          routeInfo={routeInfo}
          stops={stops}
          onAddFuelStop={onAddFuelStop}
          onToast={onToast}
        />
      )}

      {tripTips.length > 0 && (
        <div className="tips-card tips-card-compact">
          {tripTips.slice(0, 3).map((tip, i) => (
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
