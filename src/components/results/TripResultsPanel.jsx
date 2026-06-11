import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { buildItineraryDays } from "../../lib/itineraryDays.js";
import { isContinuousDrive } from "../../lib/driveMode.js";
import { parseHoursFromDuration } from "../../lib/parsing.js";
import { computeHOSCompliance } from "../../lib/hos.js";
import { isTruckerTrip } from "../../lib/vehicles.js";
import { resolveHeroVariant, classifyTripCategory } from "../../lib/resolveHeroVariant.js";
import { tipsForDisplay } from "../../lib/tripTips.js";
import ResultsHero from "./ResultsHero.jsx";
import PersonalTouchesStrip from "./PersonalTouchesStrip.jsx";
import ResultsActionTipAlert from "./ResultsActionTipAlert.jsx";
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
  timingMode,
  arriveByDate,
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
  onCollaborate,
  onToast,
  onStopSelect,
  onGuestSignUp,
  onDismissGuestBanner,
  groceryAllowed = false,
  accessToken = null,
  onUpgradeGrocery,
  isGuest = false,
  onGrocerySignIn,
  waypoints = [],
  routeLegs = [],
  onReorder,
  onNavigateToStop,
  expandedStopId = null,
  onExpandedStopIdChange,
  onRegisterTimelineScroller,
  onStartNavigation,
}) {
  const dayAnchorRefs = useRef([]);
  const stopRefs = useRef({});
  const timelineScrollRef = useRef(null);
  const [heroCollapsed, setHeroCollapsed] = useState(false);
  const [reveal, setReveal] = useState(true);

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

  const tripCategory = useMemo(() => classifyTripCategory(answers), [answers]);
  const heroVariant = useMemo(() => resolveHeroVariant(answers, tripCategory, stops), [answers, tripCategory, stops]);

  const hosCompliance = useMemo(() => {
    if (!isTruckerTrip(answers)) return null;
    const hours = parseHoursFromDuration(routeInfo?.duration);
    return hours ? computeHOSCompliance(hours) : null;
  }, [answers, routeInfo]);

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
    const el = dayAnchorRefs.current[index];
    const container = timelineScrollRef.current;
    if (el && container) {
      container.scrollTo({ top: el.offsetTop - 8, behavior: "smooth" });
    }
  }, [onDaySelect]);

  useEffect(() => {
    if (!highlightedStopId) return;
    scrollToTimelineStop(highlightedStopId);
  }, [highlightedStopId, scrollToTimelineStop]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setReveal(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setReveal(false), 1400);
    return () => window.clearTimeout(timer);
  }, []);

  function handleTimelineScroll(e) {
    setHeroCollapsed(e.currentTarget.scrollTop > 24);
  }

  return (
    <div className={`trip-results-panel trip-results-panel-${theme || "night"} trip-results-layout${panelClassName ? ` ${panelClassName}` : ""}${reveal ? " trip-results-reveal" : ""}${planOutOfDate ? " trip-results-stale" : ""}`}>
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

          <ResultsHero
            variant={heroVariant}
            collapsed={heroCollapsed}
            origin={origin}
            dest={dest}
            answers={answers}
            stops={stops}
            roadStops={roadStops}
            routeInfo={routeInfo}
            days={days}
            recommendations={recommendations}
            selectedLodging={selectedLodging}
            waypoints={waypoints}
            tripTips={displayTips}
            hosCompliance={hosCompliance}
            timingMode={timingMode}
            arriveByDate={arriveByDate}
            departureTime={departureTime}
            onDayChipSelect={scrollToDay}
            reveal={reveal}
          />

          <PersonalTouchesStrip
            touches={personalTouches}
            changesMade={changesMade}
            className={reveal ? "personal-touches-strip-reveal" : ""}
          />

          <ResultsActionTipAlert
            tips={displayTips}
            onAcceptActionTip={onAcceptActionTip}
            onDismissActionTip={onDismissActionTip}
            dismissedActionIds={dismissedActionTipIds}
          />
        </div>

        <div
          className="trip-results-timeline-scroll"
          ref={timelineScrollRef}
          onScroll={handleTimelineScroll}
        >
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
            reveal={reveal}
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
            hideActionCards
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
