import { useMemo, useRef, useEffect, useCallback } from "react";
import { buildItineraryDays } from "../../lib/itineraryDays.js";
import { isContinuousDrive } from "../../lib/driveMode.js";
import { parseHoursFromDuration } from "../../lib/parsing.js";
import { computeHOSCompliance } from "../../lib/hos.js";
import { isTruckerTrip } from "../../lib/vehicles.js";
import { formatHosSummaryLine } from "../../lib/heroVariantContent.js";
import { tipsForDisplay } from "../../lib/tripTips.js";
import TripOverviewHero from "./TripOverviewHero.jsx";
import RouteProgressBar from "../itinerary/RouteProgressBar.jsx";
import PersonalTouchesStrip from "./PersonalTouchesStrip.jsx";
import JourneyTimeline from "./JourneyTimeline.jsx";
import ResultsActionBar from "./ResultsActionBar.jsx";
import { TripTipsSection } from "../TripAlertsSection.jsx";
import WeatherWarningBanner from "../WeatherWarningBanner.jsx";
import GuestSignupBanner from "./GuestSignupBanner.jsx";
import ResultsEnrichmentSkeleton from "./ResultsEnrichmentSkeleton.jsx";
import EnrichmentNotice from "./EnrichmentNotice.jsx";
import FuelStopsSection from "../fuel/FuelStopsSection.jsx";
import StalePlanNotice from "../StalePlanNotice.jsx";
import TripConstraintsBar from "./TripConstraintsBar.jsx";

function firstStopIdForDay(day) {
  if (!day) return null;
  const road = day.roadStops?.[0];
  if (road?.id) return road.id;
  if (day.overnight?.id) return day.overnight.id;
  return null;
}

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
  waypoints = [],
  routeLegs = [],
  onReorder,
  onNavigateToStop,
  expandedStopId = null,
  onExpandedStopIdChange,
  onRegisterTimelineScroller,
  onStartNavigation,
}) {
  const stopRefs = useRef({});
  const timelineScrollRef = useRef(null);

  const continuousDrive = useMemo(() => isContinuousDrive(answers), [answers]);

  const displayTips = useMemo(() => {
    if (liveTripTips.length) {
      return tipsForDisplay(liveTripTips.map((tip) => (
        typeof tip === "string" ? { severity: "info", title: tip, detail: "" } : tip
      )));
    }
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

  const hosCompliance = useMemo(() => {
    if (!isTruckerTrip(answers)) return null;
    const hours = parseHoursFromDuration(routeInfo?.duration);
    return hours ? computeHOSCompliance(hours) : null;
  }, [answers, routeInfo]);

  const hosLine = useMemo(
    () => (hosCompliance ? formatHosSummaryLine(hosCompliance, routeInfo) : null),
    [hosCompliance, routeInfo],
  );

  const scrollToTimelineStop = useCallback((stopId) => {
    const el = stopRefs.current[stopId];
    const container = timelineScrollRef.current;
    if (!el || !container) return;
    const top = el.offsetTop - 8;
    container.scrollTo({ top, behavior: "smooth" });
  }, []);

  useEffect(() => {
    onRegisterTimelineScroller?.(scrollToTimelineStop);
  }, [onRegisterTimelineScroller, scrollToTimelineStop]);

  const scrollToDay = useCallback((index) => {
    onDaySelect?.(index);
    const stopId = firstStopIdForDay(days[index]);
    if (stopId) scrollToTimelineStop(stopId);
  }, [days, onDaySelect, scrollToTimelineStop]);

  useEffect(() => {
    if (!highlightedStopId) return;
    scrollToTimelineStop(highlightedStopId);
  }, [highlightedStopId, scrollToTimelineStop]);

  return (
    <div className={`trip-results-panel trip-results-panel-${theme || "night"} trip-results-layout${panelClassName ? ` ${panelClassName}` : ""}${planOutOfDate ? " trip-results-stale" : ""}`}>
      <header className="trip-results-topbar trip-results-topbar-with-logo">
        <button type="button" className="trip-results-back" onClick={onEditTrip}>← Edit plan</button>
        <div className="trip-results-topbar-title">Your Trip</div>
        <button type="button" className="trip-results-map-btn" onClick={onViewMap}>View on Map</button>
      </header>

      <div className="trip-results-body">
        <div className="trip-results-fixed-top">
          {routeOptimized && (
            <div className="trip-route-optimized-notice trip-route-optimized-notice-compact" role="status">
              Overnight stops reordered for a shorter drive.
            </div>
          )}

          <TripOverviewHero
            compact
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

          {hosLine && (
            <p className="results-truck-hos-line" role="status">{hosLine}</p>
          )}

          {days.length > 1 && (
            <RouteProgressBar
              days={days}
              activeDayIndex={activeDayIndex}
              onDaySelect={scrollToDay}
            />
          )}

          <PersonalTouchesStrip touches={personalTouches} changesMade={changesMade} />
        </div>

        <div className="trip-results-timeline-scroll" ref={timelineScrollRef}>
          {showGuestBanner && (
            <GuestSignupBanner onSignUp={onGuestSignUp} onDismiss={onDismissGuestBanner} />
          )}

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

          <JourneyTimeline
            waypoints={waypoints}
            routeLegs={routeLegs}
            stopRefs={stopRefs}
            highlightedStopId={highlightedStopId}
            expandedStopId={expandedStopId}
            onExpandedStopIdChange={onExpandedStopIdChange}
            onStopSelect={onStopSelect}
            onReorder={onReorder}
            restaurantsByCity={restaurantsByCity}
            isStopAdded={isStopAdded}
            onAddRoadStop={onAddRoadStop}
            onRemoveRoadStop={onRemoveRoadStop}
            onLodgingSelect={onLodgingSelect}
            onNavigateToStop={onNavigateToStop}
            onToast={onToast}
          />

          <TripTipsSection
            tips={displayTips}
            updatedAt={liveTipsUpdatedAt}
            refreshing={liveTipsRefreshing}
            onAcceptActionTip={onAcceptActionTip}
            onDismissActionTip={onDismissActionTip}
            dismissedActionIds={dismissedActionTipIds}
          />

          <p className="trip-results-places-attribution" aria-label="Google attribution">
            Restaurant and lodging details from Google
          </p>
        </div>

        <ResultsActionBar
          onStartNavigation={onStartNavigation}
          onShare={onShare}
          onEditTrip={onEditTrip}
        />
      </div>
    </div>
  );
}
