import { useRef, useEffect, useCallback } from "react";
import RoadStopCard from "./RoadStopCard.jsx";
import ActivityDiningCard from "./ActivityDiningCard.jsx";
import LodgingCardsSection from "../lodging/LodgingCardsSection.jsx";
import RestaurantCardsSection from "../restaurants/RestaurantCardsSection.jsx";
import GroceryCard from "../grocery/GroceryCard.jsx";
import WeatherIcon from "../icons/WeatherIcon.jsx";
import { resolveWeatherIconType } from "../../lib/weatherIconTypes.js";
import { tripIncludesOvernight } from "../../lib/itineraryDays.js";

function legLabel(stop) {
  if (!stop) return null;
  const parts = [stop.eta, stop.distance].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  if (stop.distanceFromRoute != null) {
    return typeof stop.distanceFromRoute === "number"
      ? `${stop.distanceFromRoute} mi from route`
      : String(stop.distanceFromRoute);
  }
  return null;
}

function findCityData(map, city) {
  if (!city || !map) return null;
  if (map[city]) return map[city];
  const key = Object.keys(map).find(k =>
    k.split(",")[0].trim().toLowerCase() === city.split(",")[0].trim().toLowerCase(),
  );
  return key ? map[key] : null;
}

function findTripResultsScrollRoot(element) {
  let node = element?.parentElement;
  while (node) {
    if (node.classList?.contains("trip-results-scroll")) return node;
    node = node.parentElement;
  }
  return null;
}

function RouteLegConnector({ label }) {
  if (!label) return null;
  return (
    <div className="results-route-leg" aria-hidden="true">
      <span className="results-route-leg-line" />
      <span className="results-route-leg-label">{label}</span>
      <span className="results-route-leg-line" />
    </div>
  );
}

export default function ResultsDaySection({
  day,
  answers,
  origin,
  dest,
  routeInfo,
  selectedLodging,
  weatherByCity = {},
  restaurantsByCity = {},
  onLodgingSelect,
  onToast,
  onAddRoadStop,
  onRemoveRoadStop,
  isStopAdded,
  isStopOnRoute,
  isResultCardHidden,
  onRemoveResultCard,
  readOnly = false,
  sectionRef,
  highlightedStopId,
  stopRefs,
  onStopSelect,
  continuousDrive = false,
  showDayHeader = false,
  showGroceryCard = false,
  stops = [],
  roadStops = [],
  recommendations = [],
  departureTime = null,
  groceryAllowed = false,
  accessToken = null,
  onUpgradeGrocery,
  isGuest = false,
  onGrocerySignIn,
  simplified = false,
  cardEnter = false,
}) {
  const sectionEl = useRef(null);

  const mergedRef = useCallback((el) => {
    sectionEl.current = el;
    if (typeof sectionRef === "function") sectionRef(el);
  }, [sectionRef]);

  useEffect(() => {
    const el = sectionEl.current;
    if (!el) return;
    const root = findTripResultsScrollRoot(el);
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) entry.target.classList.add("results-day-visible"); },
      root ? { threshold: 0.1, root } : { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [day?.dayNumber]);

  function setStopRef(id) {
    return (el) => {
      if (el && stopRefs) stopRefs.current[id] = el;
    };
  }

  const roadItems = Array.isArray(day?.roadStops)
    ? day.roadStops
    : (simplified
      ? roadStops
        .map((rs, i) => ({
          id: rs.id || `road-${i}`,
          title: rs.name,
          category: rs.category,
          rating: rs.rating,
          distanceFromRoute: rs.distanceMiles ?? rs.distance,
          photoUrl: rs.photoUrl,
          lat: rs.lat,
          lng: rs.lng,
          stopData: rs,
          nearbyRestaurants: rs.nearbyRestaurants,
        }))
        .filter(item => !isResultCardHidden?.("road", item, day?.overnightCity || dest))
      : []);

  const activities = (() => {
    if (day?.activities?.length) return day.activities;
    if (!simplified || !recommendations.length) return [];
    return recommendations.map((r, i) => ({
      id: r.id || `rec-${i}`,
      name: r.name,
      category: r.category || "Recommendation",
      rating: r.rating,
      photoUrl: r.photoUrl,
      distanceMiles: r.distanceMiles,
    }));
  })();
  const visibleActivities = activities.filter(
    item => !isResultCardHidden?.("activity", item, day?.overnightCity || dest),
  );

  const hasOvernight = tripIncludesOvernight(stops, answers);
  const showLodging = Boolean(day?.overnight) && !continuousDrive && (!simplified || hasOvernight);
  const showGrocery = showGroceryCard
    || (simplified && dest && (continuousDrive || !day?.overnight));

  const mealStops = simplified && hasOvernight && day?.overnight && !continuousDrive
    ? [day.overnight]
    : [];

  const orderedStops = roadItems.map(stop => ({ kind: "road", stop }));
  const stopsLabel = continuousDrive ? "Fuel and rest stops on your route" : "Stops on your route";

  function handleRoadRemove(stop) {
    const undoRouteRemoval = isStopOnRoute?.(stop)
      ? onRemoveRoadStop?.(stop, { showUndo: false })
      : null;
    onRemoveResultCard?.("road", stop, day?.overnightCity || dest, {
      onUndo: undoRouteRemoval || undefined,
    });
  }

  function handleActivityRemove(item) {
    const undoRouteRemoval = isStopOnRoute?.(item)
      ? onRemoveRoadStop?.(item, { showUndo: false })
      : null;
    onRemoveResultCard?.("activity", item, day?.overnightCity || dest, {
      onUndo: undoRouteRemoval,
    });
  }

  return (
    <section
      className={`results-day-section results-day-visible${simplified ? " simple-trip-section" : ""}`}
      ref={mergedRef}
    >
      {showDayHeader && (
        <>
          <div className="results-day-header">
            <h2 className="results-day-label">{day.label}</h2>
            {day.date && <span className="results-day-date">{day.date}</span>}
          </div>
          <div className="results-day-divider"/>
        </>
      )}

      {(day?.drivingSummary || !simplified) && (
        <p className="results-driving-summary">
          {!simplified && <span className="results-driving-summary-label">Today&apos;s drive</span>}
          {day?.drivingSummary?.miles} · {day?.drivingSummary?.duration}
          {simplified ? " driving" : null}
        </p>
      )}
      {day?.scheduleHint && (
        <p className="results-schedule-hint" role="note">{day.scheduleHint}</p>
      )}

      {orderedStops.length > 0 && (
        <div className="results-subsection">
          <h3 className="results-subsection-label">{stopsLabel}</h3>
          <div className={simplified ? "results-road-stops-scroll" : "results-route-timeline"}>
            {orderedStops.map((item, index) => (
              simplified ? (
                <RoadStopCard
                  key={item.stop.id || `${item.kind}-${index}`}
                  stop={item.stop}
                  staggerIndex={index}
                  cardEnter={cardEnter}
                  onAdd={onAddRoadStop}
                  onRemove={handleRoadRemove}
                  onToast={onToast}
                  added={isStopAdded?.(item.stop)}
                  onRoute={isStopOnRoute?.(item.stop)}
                  readOnly={readOnly}
                  onSelect={stopItem => onStopSelect?.({
                    ...stopItem,
                    lat: stopItem.lat ?? stopItem.stopData?.lat,
                    lng: stopItem.lng ?? stopItem.stopData?.lng,
                  })}
                  highlighted={highlightedStopId === item.stop.id}
                  cardRef={setStopRef(item.stop.id)}
                />
              ) : (
                <div key={item.stop.id || `${item.kind}-${index}`} className="results-route-timeline-item">
                  {index > 0 && <RouteLegConnector label={legLabel(item.stop) || "Continue driving"} />}
                  <RoadStopCard
                    stop={item.stop}
                    staggerIndex={index}
                    cardEnter={cardEnter}
                    onAdd={onAddRoadStop}
                    onRemove={handleRoadRemove}
                    onToast={onToast}
                    added={isStopAdded?.(item.stop)}
                    onRoute={isStopOnRoute?.(item.stop)}
                    readOnly={readOnly}
                    onSelect={onStopSelect}
                    highlighted={highlightedStopId === item.stop.id}
                    cardRef={setStopRef(item.stop.id)}
                  />
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {showLodging && (
        <>
          <LodgingCardsSection
            city={day.overnight.city}
            answers={answers}
            origin={origin}
            dest={dest}
            routeInfo={routeInfo}
            selectedLodging={selectedLodging}
            onLodgingSelect={onLodgingSelect}
            onToast={onToast}
            readOnly={readOnly}
            isResultCardHidden={isResultCardHidden}
            onRemoveResultCard={onRemoveResultCard}
          />
          <RestaurantCardsSection
            city={day.overnight.city}
            lat={day.overnight.lat}
            lng={day.overnight.lng}
            answers={answers}
            preloaded={findCityData(restaurantsByCity, day.overnight.city)}
            onToast={onToast}
            onDirections={onStopSelect}
            readOnly={readOnly}
            isResultCardHidden={isResultCardHidden}
            onRemoveResultCard={onRemoveResultCard}
          />
        </>
      )}

      {showGrocery && dest && (
        <div className="results-subsection grocery-card-section">
          <GroceryCard
            origin={origin}
            dest={dest}
            selectedLodging={selectedLodging}
            stops={stops}
            routeInfo={routeInfo}
            departureTime={departureTime}
            onToast={onToast}
            groceryAllowed={groceryAllowed}
            accessToken={accessToken}
            onUpgrade={onUpgradeGrocery}
            isGuest={isGuest}
            onSignIn={onGrocerySignIn}
          />
        </div>
      )}

      {mealStops.map((stop, idx) => {
        const city = stop.city || dest;
        const weather = findCityData(weatherByCity, city);
        const preloaded = findCityData(restaurantsByCity, city);
        const lat = stop.lat
          ?? routeInfo?.destLat
          ?? routeInfo?.routePoints?.[routeInfo.routePoints.length - 1]?.lat
          ?? weather?.lat;
        const lng = stop.lng
          ?? routeInfo?.destLng
          ?? routeInfo?.routePoints?.[routeInfo.routePoints.length - 1]?.lng
          ?? weather?.lng;
        if (!city) return null;
        return (
          <div className="results-subsection" key={stop.id || `meal-${idx}`}>
            <h3 className="results-subsection-label">
              {idx === 0 && dest ? "Meals near your destination" : `Meals in ${city.split(",")[0]}`}
            </h3>
            {weather?.temperatureDisplay && (
              <div className="simple-trip-weather-badge" title={weather.condition}>
                <WeatherIcon
                  type={weather.iconType || resolveWeatherIconType(weather.condition)}
                  className="overnight-weather-icon"
                />
                <span className="overnight-weather-temp">{weather.temperatureDisplay}</span>
                <span className="simple-trip-weather-city">{city.split(",")[0]}</span>
              </div>
            )}
            <RestaurantCardsSection
              city={city}
              lat={lat}
              lng={lng}
              answers={answers}
              preloaded={preloaded}
              onToast={onToast}
              overnightMode
              onDirections={onStopSelect}
              readOnly={readOnly}
              isResultCardHidden={isResultCardHidden}
              onRemoveResultCard={onRemoveResultCard}
            />
          </div>
        );
      })}

      {visibleActivities.length > 0 && (
        <div className="results-subsection">
          <h3 className="results-subsection-label">Optional extras along the way</h3>
          <div className="results-activities-grid">
            {visibleActivities.map(item => (
              <ActivityDiningCard
                key={item.id || item.placeId || `${item.name}-${item.lat}-${item.lng}`}
                item={item}
                onAdd={onAddRoadStop}
                onRemove={handleActivityRemove}
                added={isStopAdded?.(item)}
                onRoute={isStopOnRoute?.(item)}
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
