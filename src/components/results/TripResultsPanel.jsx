import { useMemo, useRef, useEffect } from "react";
import { buildItineraryDays, isSimplifiedTrip } from "../../lib/itineraryDays.js";
import TripOverviewHero from "./TripOverviewHero.jsx";
import RouteProgressBar from "../itinerary/RouteProgressBar.jsx";
import ResultsDaySection from "./ResultsDaySection.jsx";
import SimpleTripSection from "./SimpleTripSection.jsx";
import TripSummaryFooter from "./TripSummaryFooter.jsx";
import TripAlertsBanner from "../TripAlertsSection.jsx";
import WeatherWarningBanner from "../WeatherWarningBanner.jsx";
import GuestSignupBanner from "./GuestSignupBanner.jsx";

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
  weatherByCity = {},
  routeOptimized = false,
  departureTime,
  activeDayIndex = 0,
  highlightedStopId = null,
  showGuestBanner = false,
  onEditTrip,
  onViewMap,
  onDaySelect,
  onAddRoadStop,
  onLodgingSelect,
  onDismissAlert,
  onShare,
  onToast,
  onStopSelect,
  onGuestSignUp,
  onDismissGuestBanner,
}) {
  const dayRefs = useRef([]);
  const stopRefs = useRef({});
  const scrollRef = useRef(null);

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

  useEffect(() => {
    if (!highlightedStopId) return;
    const el = stopRefs.current[highlightedStopId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightedStopId]);

  return (
    <div className={`trip-results-panel trip-results-panel-${theme || "night"}`}>
      <header className="trip-results-topbar trip-results-topbar-with-logo">
        <button type="button" className="trip-results-back" onClick={onEditTrip}>← Edit Trip</button>
        <div className="trip-results-topbar-title">Your Trip</div>
        <button type="button" className="trip-results-map-btn" onClick={onViewMap}>View on Map</button>
      </header>

      <div className="trip-results-scroll" ref={scrollRef}>
        {showGuestBanner && (
          <GuestSignupBanner onSignUp={onGuestSignUp} onDismiss={onDismissGuestBanner} />
        )}

        <TripOverviewHero
          origin={origin}
          dest={dest}
          routeInfo={{ ...routeInfo, routeOptimized }}
          stops={stops}
          roadStops={roadStops}
          answers={answers}
          tripLegs={tripLegs}
          selectedLodging={selectedLodging}
          restaurantsByCity={restaurantsByCity}
        />

        <WeatherWarningBanner alerts={tripAlerts} />

        {!simplified && days.length > 1 && (
          <RouteProgressBar days={days} activeDayIndex={activeDayIndex} onDaySelect={scrollToDay} />
        )}

        <TripAlertsBanner alerts={tripAlerts} onDismiss={onDismissAlert} />

        {simplified ? (
          <SimpleTripSection
            days={days}
            stops={stops}
            roadStops={roadStops}
            recommendations={recommendations}
            answers={answers}
            origin={origin}
            dest={dest}
            routeInfo={routeInfo}
            weatherByCity={weatherByCity}
            restaurantsByCity={restaurantsByCity}
            selectedLodging={selectedLodging}
            onLodgingSelect={onLodgingSelect}
            onToast={onToast}
            onAddRoadStop={onAddRoadStop}
            highlightedStopId={highlightedStopId}
            stopRefs={stopRefs}
            onStopSelect={onStopSelect}
          />
        ) : (
          days.map((day, i) => (
            <ResultsDaySection
              key={day.dayNumber}
              day={day}
              answers={answers}
              origin={origin}
              dest={dest}
              routeInfo={routeInfo}
              selectedLodging={selectedLodging}
              weatherByCity={weatherByCity}
              restaurantsByCity={restaurantsByCity}
              onLodgingSelect={onLodgingSelect}
              onToast={onToast}
              onAddRoadStop={onAddRoadStop}
              highlightedStopId={highlightedStopId}
              stopRefs={stopRefs}
              onStopSelect={onStopSelect}
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
          restaurantsByCity={restaurantsByCity}
          onShare={onShare}
        />
      </div>
    </div>
  );
}
