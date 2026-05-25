import { useMemo, useRef } from "react";
import { buildItineraryDays, isSimplifiedTrip } from "../../lib/itineraryDays.js";
import TripOverviewHero from "./TripOverviewHero.jsx";
import RouteProgressBar from "../itinerary/RouteProgressBar.jsx";
import ResultsDaySection from "./ResultsDaySection.jsx";
import SimpleTripSection from "./SimpleTripSection.jsx";
import TripSummaryFooter from "./TripSummaryFooter.jsx";
import TripAlertsBanner from "../TripAlertsSection.jsx";

export default function TripResultsPanel({
  theme,
  origin,
  dest,
  answers,
  stops,
  roadStops,
  routeInfo,
  tripLegs,
  tripFormat,
  recommendations = [],
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
  const simplified = useMemo(
    () => isSimplifiedTrip({ answers, routeInfo, stops, tripFormat }),
    [answers, routeInfo, stops, tripFormat],
  );

  const days = useMemo(() => buildItineraryDays({
    origin,
    dest,
    stops,
    roadStops,
    routeInfo,
    departureTime,
    activitiesByCity,
    restaurantsByCity,
    recommendations,
  }), [origin, dest, stops, roadStops, routeInfo, departureTime, activitiesByCity, restaurantsByCity, recommendations]);

  function scrollToDay(index) {
    onDaySelect?.(index);
    dayRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className={`trip-results-panel trip-results-panel-${theme || "night"}`}>
      <header className="trip-results-topbar">
        <button type="button" className="trip-results-back" onClick={onEditTrip}>← Edit Trip</button>
        <div className="trip-results-topbar-title">Your Trip</div>
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

        {!simplified && days.length > 1 && (
          <RouteProgressBar days={days} activeDayIndex={activeDayIndex} onDaySelect={scrollToDay} />
        )}

        <TripAlertsBanner alerts={tripAlerts} onDismiss={onDismissAlert} />

        {simplified ? (
          <SimpleTripSection
            days={days}
            roadStops={roadStops}
            recommendations={recommendations}
            onAddRoadStop={onAddRoadStop}
          />
        ) : (
          days.map((day, i) => (
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
          ))
        )}

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
