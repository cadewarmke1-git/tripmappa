import { useMemo, useRef, useEffect } from "react";
import { buildItineraryDays, isSimplifiedTrip } from "../../lib/itineraryDays.js";
import { isContinuousDrive } from "../../lib/driveMode.js";
import { tipsForDisplay } from "../../lib/tripTips.js";
import TripOverviewHero from "./TripOverviewHero.jsx";
import ResultsDaySection from "./ResultsDaySection.jsx";
import SimpleTripSection from "./SimpleTripSection.jsx";
import { TripTipsSection } from "../TripAlertsSection.jsx";
import PlannedForYouSection from "./PlannedForYouSection.jsx";
import PersonalTouchesStrip from "./PersonalTouchesStrip.jsx";
import ResultsActionBar from "./ResultsActionBar.jsx";
import WeatherWarningBanner from "../WeatherWarningBanner.jsx";
import GuestSignupBanner from "./GuestSignupBanner.jsx";
import ResultsEnrichmentSkeleton from "./ResultsEnrichmentSkeleton.jsx";
import EnrichmentNotice from "./EnrichmentNotice.jsx";
import FuelStopsSection from "../fuel/FuelStopsSection.jsx";
import StalePlanNotice from "../StalePlanNotice.jsx";
import TripConstraintsBar from "./TripConstraintsBar.jsx";

export default function TripResultsPanel({
  panelClassName = "",
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
  onAcceptActionTip,
  onDismissActionTip,
  dismissedActionTipIds = [],
  personalTouches = [],
  changesMade = [],
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
  onStartNavigation,
  // Accepted from App.jsx but unused after timeline layout removal
  waypoints: _waypoints,
  routeLegs: _routeLegs,
  onReorder: _onReorder,
  onNavigateToStop: _onNavigateToStop,
  expandedStopId: _expandedStopId,
  onExpandedStopIdChange: _onExpandedStopIdChange,
  onRegisterTimelineScroller: _onRegisterTimelineScroller,
  onDismissAlert: _onDismissAlert,
  onCollaborate: _onCollaborate,
  timingMode: _timingMode,
  arriveByDate: _arriveByDate,
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
    if (liveTripTips.length) return tipsForDisplay(liveTripTips);
    return tipsForDisplay(tripTips);
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

  const isMultiDay = !simplified && days.length > 1;
  const activeDay = days[Math.min(activeDayIndex, Math.max(0, days.length - 1))] ?? days[0];
  const activeDayIdx = days.indexOf(activeDay);

  function selectDay(index) {
    onDaySelect?.(index);
  }

  useEffect(() => {
    if (!highlightedStopId) return;
    const el = stopRefs.current[highlightedStopId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightedStopId]);

  return (
    <div className={`trip-results-panel trip-results-panel-${theme || "night"} view-panel-animate${panelClassName ? ` ${panelClassName}` : ""}${planOutOfDate ? " trip-results-stale" : ""}`}>
      <header className="trip-results-topbar trip-results-topbar-with-logo">
        <button type="button" className="trip-results-back" onClick={onEditTrip}>← Edit plan</button>
        <div className="trip-results-topbar-title">Your Trip</div>
        <button type="button" className="trip-results-map-btn" onClick={onViewMap}>View on Map</button>
      </header>

      <div className="trip-results-shell">
        <div className="trip-results-sticky-summary">
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
        </div>

        {isMultiDay && (
          <div className="results-day-tabs" role="tablist" aria-label="Trip days">
            {days.map((day, i) => (
              <button
                key={day.dayNumber}
                type="button"
                role="tab"
                aria-selected={activeDayIdx === i}
                className={`results-day-tab${activeDayIdx === i ? " results-day-tab-active" : ""}`}
                onClick={() => selectDay(i)}
              >
                <span className="results-day-tab-label">{day.label}</span>
                {day.date && <span className="results-day-tab-date">{day.date}</span>}
              </button>
            ))}
          </div>
        )}

        <div className="trip-results-scroll" ref={scrollRef}>
          {showGuestBanner && (
            <GuestSignupBanner onSignUp={onGuestSignUp} onDismiss={onDismissGuestBanner} />
          )}

          <PlannedForYouSection touches={personalTouches} changesMade={changesMade} />
          <PersonalTouchesStrip touches={personalTouches} changesMade={changesMade} />

          <WeatherWarningBanner alerts={tripAlerts} />

          {tripUsedFallback && (
            <div className="trip-fallback-notice" role="status">
              This trip uses estimated route data from an earlier session.
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

          <TripTipsSection
            tips={displayTips}
            updatedAt={liveTipsUpdatedAt}
            refreshing={liveTipsRefreshing}
            onAcceptActionTip={onAcceptActionTip}
            onDismissActionTip={onDismissActionTip}
            dismissedActionIds={dismissedActionTipIds}
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
          ) : activeDay && (
            <ResultsDaySection
              key={activeDay.dayNumber}
              day={activeDay}
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
              sectionRef={el => { dayRefs.current[activeDayIdx] = el; }}
              showGroceryCard={activeDayIdx === days.length - 1}
              stops={stops}
              departureTime={departureTime}
              groceryAllowed={groceryAllowed}
              accessToken={accessToken}
              onUpgradeGrocery={onUpgradeGrocery}
              isGuest={isGuest}
              onGrocerySignIn={onGrocerySignIn}
            />
          )}
        </div>

        <ResultsActionBar
          onStartNavigation={onStartNavigation}
          onShare={onShare}
          onEditTrip={onEditTrip}
          onViewMap={onViewMap}
        />
      </div>
    </div>
  );
}
