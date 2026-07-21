import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { buildItineraryDays, isSimplifiedTrip } from "../../lib/itineraryDays.js";
import { isContinuousDrive } from "../../lib/driveMode.js";
import TripOverviewHero from "./TripOverviewHero.jsx";
import ResultsDaySection from "./ResultsDaySection.jsx";
import PlannedForYouSection from "./PlannedForYouSection.jsx";
import ResultsActionBar from "./ResultsActionBar.jsx";
import ResultsEnrichmentSkeleton from "./ResultsEnrichmentSkeleton.jsx";
import EnrichmentNotice from "./EnrichmentNotice.jsx";
import FuelStopsSection from "../fuel/FuelStopsSection.jsx";
import StalePlanNotice from "../StalePlanNotice.jsx";
import { SharedItineraryHeader, SharedItineraryFooter } from "./SharedItineraryChrome.jsx";
import { detectPartialTripResults } from "../../lib/partialTripResults.js";

function resultCardIdentity(kind, item, context = "") {
  const id = item?.placeId
    || item?.place_id
    || item?.id
    || `${item?.name || item?.title || "stop"}-${item?.lat ?? ""}-${item?.lng ?? ""}`;
  return `${kind}:${context}:${id}`;
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
  tripFormat,
  recommendations = [],
  selectedLodging = [],
  personalTouches = [],
  changesMade = [],
  enrichingTrip = false,
  enrichmentLimited = false,
  planOutOfDate = false,
  onRegenerateTrip,
  generateLoading = false,
  onCancelEnrichment,
  tripUsedFallback = false,
  onDismissEnrichmentNotice,
  onRetryEnrichment,
  onEnrichPlacesOnMount,
  isStopAdded,
  optionalStopCards = [],
  activitiesByCity = {},
  restaurantsByCity = {},
  weatherByCity = {},
  routeOptimized = false,
  departureTime,
  activeDayIndex = 0,
  highlightedStopId = null,
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
  groceryAllowed = false,
  accessToken = null,
  onUpgradeGrocery,
  isGuest = false,
  onGrocerySignIn,
  onStartNavigation,
  shareMode = false,
  isStopOnRoute,
  // Accepted from App.jsx but unused after timeline layout removal
  waypoints = null,
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
  const [cardEnter, setCardEnter] = useState(true);
  const [hiddenResultCardIds, setHiddenResultCardIds] = useState(() => new Set());

  const isResultCardHidden = useCallback((kind, item, context = "") => (
    hiddenResultCardIds.has(resultCardIdentity(kind, item, context))
  ), [hiddenResultCardIds]);

  const removeResultCard = useCallback((kind, item, context = "", options = {}) => {
    const key = resultCardIdentity(kind, item, context);
    setHiddenResultCardIds(previous => {
      const next = new Set(previous);
      next.add(key);
      return next;
    });
    onToast?.("Stop removed —", {
      actionLabel: "Undo",
      duration: 8000,
      onAction: () => {
        setHiddenResultCardIds(previous => {
          const next = new Set(previous);
          next.delete(key);
          return next;
        });
        options.onUndo?.();
      },
    });
  }, [onToast]);

  const simplified = useMemo(
    () => isSimplifiedTrip({ answers, routeInfo, stops, tripFormat }),
    [answers, routeInfo, stops, tripFormat],
  );

  const continuousDrive = useMemo(() => isContinuousDrive(answers), [answers]);

  const rawDays = useMemo(() => buildItineraryDays({
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

  const days = useMemo(() => rawDays
    .map(day => {
      const context = day.overnightCity || dest;
      return {
        ...day,
        roadStops: (day.roadStops || []).filter(
          item => !isResultCardHidden("road", item, context),
        ),
        activities: (day.activities || []).filter(
          item => !isResultCardHidden("activity", item, context),
        ),
      };
    })
    .filter(day => Boolean(day.overnight || day.roadStops.length || day.activities.length)), [
    rawDays,
    dest,
    isResultCardHidden,
  ]);

  const isMultiDay = !simplified && days.length > 1;
  const activeDay = days[Math.min(activeDayIndex, Math.max(0, days.length - 1))] ?? days[0];
  const activeDayIdx = days.indexOf(activeDay);

  const showPartialResultsWarning = useMemo(() => detectPartialTripResults({
    stops,
    roadStops,
    answers,
    days,
    restaurantsByCity,
    enrichingTrip,
    enrichingPlaces: false,
  }), [stops, roadStops, answers, days, restaurantsByCity, enrichingTrip]);

  function selectDay(index) {
    onDaySelect?.(index);
  }

  useEffect(() => {
    onEnrichPlacesOnMount?.();
  }, [onEnrichPlacesOnMount]);

  useEffect(() => {
    const stopCount = Math.max(roadStops?.length || 0, stops?.length || 0, 6);
    const duration = 200 + stopCount * 60;
    const t = window.setTimeout(() => setCardEnter(false), duration);
    return () => window.clearTimeout(t);
  }, [roadStops?.length, stops?.length]);

  useEffect(() => {
    if (!highlightedStopId) return;
    const el = stopRefs.current[highlightedStopId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightedStopId]);

  return (
    <div className={`trip-results-panel trip-results-panel-${theme || "night"} view-panel-animate${panelClassName ? ` ${panelClassName}` : ""}${planOutOfDate ? " trip-results-stale" : ""}${shareMode ? " trip-results-panel--shared" : ""}`}>
      {shareMode ? (
        <SharedItineraryHeader origin={origin} dest={dest} />
      ) : (
        <header className="trip-results-topbar trip-results-topbar-with-logo">
          <button type="button" className="trip-results-back" onClick={onEditTrip}>← Edit plan</button>
          <div className="trip-results-topbar-title">Your Trip</div>
          <button type="button" className="trip-results-map-btn" onClick={onViewMap}>View on Map</button>
        </header>
      )}

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
            waypoints={waypoints}
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
          <PlannedForYouSection touches={personalTouches} changesMade={changesMade} />

          {tripUsedFallback && (
            <div className="trip-fallback-notice" role="status">
              This trip uses estimated route data from an earlier session.
            </div>
          )}

          {planOutOfDate ? (
            <StalePlanNotice onRegenerate={onRegenerateTrip} loading={generateLoading} />
          ) : showPartialResultsWarning ? (
            <div className="trip-partial-results-notice" role="status">
              Some stops along your route couldn&apos;t be verified — results may be incomplete
            </div>
          ) : null}

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
              readOnly={shareMode}
            />
          )}

          {activeDay && (
            <ResultsDaySection
              key={simplified ? "simplified" : activeDay.dayNumber}
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
              isStopOnRoute={isStopOnRoute}
              isResultCardHidden={isResultCardHidden}
              onRemoveResultCard={removeResultCard}
              readOnly={shareMode}
              highlightedStopId={highlightedStopId}
              stopRefs={stopRefs}
              onStopSelect={onStopSelect}
              sectionRef={el => { dayRefs.current[activeDayIdx] = el; }}
              showGroceryCard={simplified || activeDayIdx === days.length - 1}
              stops={stops}
              roadStops={roadStops}
              recommendations={recommendations}
              departureTime={departureTime}
              groceryAllowed={groceryAllowed}
              accessToken={accessToken}
              onUpgradeGrocery={onUpgradeGrocery}
              isGuest={isGuest}
              onGrocerySignIn={onGrocerySignIn}
              cardEnter={cardEnter}
              simplified={simplified}
            />
          )}
        </div>

        {shareMode ? (
          <SharedItineraryFooter />
        ) : (
          <ResultsActionBar
            onStartNavigation={onStartNavigation}
            onShare={onShare}
            onEditTrip={onEditTrip}
          />
        )}
      </div>
    </div>
  );
}
