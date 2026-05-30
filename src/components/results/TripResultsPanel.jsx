import { useMemo, useRef, useEffect } from "react";
import { buildItineraryDays, isSimplifiedTrip } from "../../lib/itineraryDays.js";
import { isContinuousDrive } from "../../lib/driveMode.js";
import TripOverviewHero from "./TripOverviewHero.jsx";
import RouteProgressBar from "../itinerary/RouteProgressBar.jsx";
import ResultsDaySection from "./ResultsDaySection.jsx";
import SimpleTripSection from "./SimpleTripSection.jsx";
import TripSummaryFooter from "./TripSummaryFooter.jsx";
import { TripTipsSection } from "../TripAlertsSection.jsx";
import WeatherWarningBanner from "../WeatherWarningBanner.jsx";
import GuestSignupBanner from "./GuestSignupBanner.jsx";
import ResultsEnrichmentSkeleton from "./ResultsEnrichmentSkeleton.jsx";
import EnrichmentNotice from "./EnrichmentNotice.jsx";
import FuelStopsSection from "../fuel/FuelStopsSection.jsx";
import StalePlanNotice from "../StalePlanNotice.jsx";
import TripConstraintsBar from "./TripConstraintsBar.jsx";

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
  liveTripTips = [],
  tripTips = [],
  liveTipsUpdatedAt = null,
  liveTipsRefreshing = false,
  enrichingTrip = false,
  enrichmentLimited = false,
  planOutOfDate = false,
  planChanges = [],
  onRegenerateTrip,
  generateLoading = false,
  onCancelEnrichment,
  tripUsedFallback = false,
  onDismissEnrichmentNotice,
  onRetryEnrichment,
  isStopAdded,
  optionalStopCards = [],
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
  onRemoveRoadStop,
  onAddFuelStop,
  onLodgingSelect,
  onDismissAlert,
  onShare,
  onToast,
  onStopSelect,
  onGuestSignUp,
  onDismissGuestBanner,
  groceryAllowed = false,
  accessToken = null,
  onUpgradeGrocery,
  isGuest = false,
  onGrocerySignIn,
}) {
  const dayRefs = useRef([]);
  const stopRefs = useRef({});
  const scrollRef = useRef(null);

  const simplified = useMemo(
    () => isSimplifiedTrip({ answers, routeInfo, stops, tripFormat }),
    [answers, routeInfo, stops, tripFormat],
  );

  const continuousDrive = useMemo(() => isContinuousDrive(answers), [answers]);

  const displayTips = useMemo(() => {
    if (liveTripTips.length) return liveTripTips.slice(0, 5);
    const seen = new Set();
    const lines = [];
    tripTips.forEach((tip) => {
      const line = typeof tip === "string" ? tip : (tip.message || tip.title);
      if (!line || seen.has(line)) return;
      seen.add(line);
      lines.push(line);
    });
    return lines.slice(0, 5);
  }, [liveTripTips, tripTips]);

  const days = useMemo(() => buildItineraryDays({
    origin,
    dest,
    stops,
    roadStops,
    routeInfo,
    departureTime,
    answers,
    optionalStopCards,
    activitiesByCity,
    restaurantsByCity,
    recommendations,
  }), [origin, dest, stops, roadStops, routeInfo, departureTime, answers, optionalStopCards, activitiesByCity, restaurantsByCity, recommendations]);

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
    <div className={`trip-results-panel trip-results-panel-${theme || "night"} view-panel-animate${planOutOfDate ? " trip-results-stale" : ""}`}>
      <header className="trip-results-topbar trip-results-topbar-with-logo">
        <button type="button" className="trip-results-back" onClick={onEditTrip}>← Edit plan</button>
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
          routeInfo={routeInfo}
          routeOptimized={routeOptimized || routeInfo?.routeOptimized}
          stops={stops}
          roadStops={roadStops}
          answers={answers}
          tripLegs={tripLegs}
          selectedLodging={selectedLodging}
          restaurantsByCity={restaurantsByCity}
        />

        <WeatherWarningBanner alerts={tripAlerts} />

        {tripUsedFallback && (
          <div className="trip-fallback-notice" role="status">
            This trip uses estimated route data — live AI planning was unavailable or returned incomplete results.
          </div>
        )}

        {planOutOfDate && (
          <StalePlanNotice onRegenerate={onRegenerateTrip} loading={generateLoading} changes={planChanges} />
        )}

        <TripConstraintsBar answers={answers} routeInfo={routeInfo} />

        <EnrichmentNotice
          limited={enrichmentLimited}
          onDismiss={onDismissEnrichmentNotice}
          onRetry={onRetryEnrichment}
          enriching={enrichingTrip}
          onCancel={onCancelEnrichment}
        />

        {!simplified && days.length > 1 && (
          <div className="route-progress-sticky-wrap">
            <RouteProgressBar days={days} activeDayIndex={activeDayIndex} onDaySelect={scrollToDay} />
          </div>
        )}

        <TripTipsSection
          tips={displayTips}
          updatedAt={liveTipsUpdatedAt}
          refreshing={liveTipsRefreshing}
        />

        {enrichingTrip && <ResultsEnrichmentSkeleton theme={theme} />}

        {continuousDrive && (
          <FuelStopsSection
            answers={answers}
            routeInfo={routeInfo}
            stops={stops}
            onAddFuelStop={onAddFuelStop}
            onToast={onToast}
          />
        )}

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
            continuousDrive={continuousDrive}
            onLodgingSelect={onLodgingSelect}
            onToast={onToast}
            onAddRoadStop={onAddRoadStop}
            onRemoveRoadStop={onRemoveRoadStop}
            isStopAdded={isStopAdded}
            highlightedStopId={highlightedStopId}
            stopRefs={stopRefs}
            onStopSelect={onStopSelect}
            departureTime={departureTime}
            groceryAllowed={groceryAllowed}
            accessToken={accessToken}
            onUpgradeGrocery={onUpgradeGrocery}
            isGuest={isGuest}
            onGrocerySignIn={onGrocerySignIn}
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
              continuousDrive={continuousDrive}
              weatherByCity={weatherByCity}
              restaurantsByCity={restaurantsByCity}
              onLodgingSelect={onLodgingSelect}
              onToast={onToast}
              onAddRoadStop={onAddRoadStop}
            onRemoveRoadStop={onRemoveRoadStop}
              isStopAdded={isStopAdded}
              highlightedStopId={highlightedStopId}
              stopRefs={stopRefs}
              onStopSelect={onStopSelect}
              sectionRef={el => { dayRefs.current[i] = el; }}
              showGroceryCard={i === days.length - 1}
              stops={stops}
              departureTime={departureTime}
              groceryAllowed={groceryAllowed}
              accessToken={accessToken}
              onUpgradeGrocery={onUpgradeGrocery}
              isGuest={isGuest}
              onGrocerySignIn={onGrocerySignIn}
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
