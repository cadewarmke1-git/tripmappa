import { useMemo, useRef } from "react";
import { buildItineraryDays } from "../../lib/itineraryDays.js";
import TripOverviewHero from "./TripOverviewHero.jsx";
import RouteProgressBar from "../itinerary/RouteProgressBar.jsx";
import ResultsDaySection from "./ResultsDaySection.jsx";
import TripSummaryFooter from "./TripSummaryFooter.jsx";
import TripAlertsBanner from "../TripAlertsSection.jsx";

export default function TripResultsPanel({
  origin,
  dest,
  answers,
  stops,
  roadStops,
  routeInfo,
  tripLegs,
  selectedLodging = [],
  tripAlerts = [],
  activitiesByCity = {},
  restaurantsByCity = {},
  departureTime,
  activeDayIndex = 0,
  onEditTrip,
  onViewMap,
  onDaySelect,
  onAddRoadStop,
  onLodgingSelect,
  onDismissAlert,
  onShare,
  onToast,
}) {
  const dayRefs = useRef([]);

  const days = useMemo(() => buildItineraryDays({
    origin,
    dest,
    stops,
    roadStops,
    routeInfo,
    departureTime,
    activitiesByCity,
    restaurantsByCity,
  }), [origin, dest, stops, roadStops, routeInfo, departureTime, activitiesByCity, restaurantsByCity]);

  function scrollToDay(index) {
    onDaySelect?.(index);
    dayRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="trip-results-panel">
      <header className="trip-results-topbar">
        <button type="button" className="trip-results-back" onClick={onEditTrip}>← Edit Trip</button>
        <div className="trip-results-topbar-title">Your Itinerary</div>
        <button type="button" className="trip-results-map-btn" onClick={onViewMap}>View on Map</button>
      </header>

      <div className="trip-results-scroll">
        <TripOverviewHero
          origin={origin}
          dest={dest}
          routeInfo={routeInfo}
          stops={stops}
          roadStops={roadStops}
          answers={answers}
          tripLegs={tripLegs}
          selectedLodging={selectedLodging}
        />

        <RouteProgressBar days={days} activeDayIndex={activeDayIndex} onDaySelect={scrollToDay} />

        <TripAlertsBanner alerts={tripAlerts} onDismiss={onDismissAlert} />

        {days.map((day, i) => (
          <ResultsDaySection
            key={day.dayNumber}
            day={day}
            answers={answers}
            routeInfo={routeInfo}
            selectedLodging={selectedLodging}
            onLodgingSelect={onLodgingSelect}
            onToast={onToast}
            onAddRoadStop={onAddRoadStop}
            sectionRef={el => { dayRefs.current[i] = el; }}
          />
        ))}

        <TripSummaryFooter
          answers={answers}
          routeInfo={routeInfo}
          tripLegs={tripLegs}
          roadStops={roadStops}
          selectedLodging={selectedLodging}
          onShare={onShare}
        />
      </div>
    </div>
  );
}
