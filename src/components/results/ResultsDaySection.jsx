import { useRef, useEffect, useCallback } from "react";
import RoadStopCard from "./RoadStopCard.jsx";
import OvernightStayCard from "./OvernightStayCard.jsx";
import ActivityDiningCard from "./ActivityDiningCard.jsx";
import LodgingCardsSection from "../lodging/LodgingCardsSection.jsx";
import RestaurantCardsSection from "../restaurants/RestaurantCardsSection.jsx";
import GroceryCard from "../grocery/GroceryCard.jsx";

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
  sectionRef,
  highlightedStopId,
  stopRefs,
  onStopSelect,
  continuousDrive = false,
  showGroceryCard = false,
  stops = [],
  departureTime = null,
  groceryAllowed = false,
  accessToken = null,
  onUpgradeGrocery,
  isGuest = false,
  onGrocerySignIn,
}) {
  const sectionEl = useRef(null);

  const mergedRef = useCallback((el) => {
    sectionEl.current = el;
    if (typeof sectionRef === "function") sectionRef(el);
  }, [sectionRef]);

  useEffect(() => {
    const el = sectionEl.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) entry.target.classList.add("results-day-visible"); },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [day.dayNumber]);

  function setStopRef(id) {
    return (el) => {
      if (el && stopRefs) stopRefs.current[id] = el;
    };
  }

  const orderedStops = [
    ...(day.roadStops || []).map(stop => ({ kind: "road", stop })),
    ...(!continuousDrive && day.overnight ? [{ kind: "overnight", stop: day.overnight }] : []),
  ];

  return (
    <section className="results-day-section" ref={mergedRef}>
      <div className="results-day-header">
        <h2 className="results-day-label">{day.label}</h2>
        {day.date && <span className="results-day-date">{day.date}</span>}
      </div>
      <div className="results-day-divider"/>

      <p className="results-driving-summary">
        <span className="results-driving-summary-label">Today&apos;s drive</span>
        {day.drivingSummary?.miles} · {day.drivingSummary?.duration}
      </p>
      {day.scheduleHint && (
        <p className="results-schedule-hint" role="note">{day.scheduleHint}</p>
      )}

      {orderedStops.length > 0 && (
        <div className="results-subsection">
          <h3 className="results-subsection-label">Stops Along the Route</h3>
          <div className="results-route-timeline">
            {orderedStops.map((item, index) => (
              <div key={item.stop.id || `${item.kind}-${index}`} className="results-route-timeline-item">
                {index > 0 && <RouteLegConnector label={legLabel(item.stop) || "Continue driving"} />}
                {item.kind === "road" ? (
                  <RoadStopCard
                    stop={item.stop}
                    onAdd={onAddRoadStop}
                    onRemove={onRemoveRoadStop}
                    onToast={onToast}
                    added={isStopAdded?.(item.stop)}
                    onSelect={onStopSelect}
                    highlighted={highlightedStopId === item.stop.id}
                    cardRef={setStopRef(item.stop.id)}
                  />
                ) : (
                  <OvernightStayCard
                    overnight={item.stop}
                    answers={answers}
                    routeInfo={routeInfo}
                    selectedLodging={selectedLodging}
                    weather={weatherByCity[item.stop.city]}
                    onLodgingSelect={onLodgingSelect}
                    onToast={onToast}
                    onSelect={onStopSelect}
                    highlighted={highlightedStopId === (item.stop.id || `overnight-${item.stop.city}`)}
                    cardRef={setStopRef(item.stop.id || `overnight-${item.stop.city}`)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {day.overnight && !continuousDrive && (
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
          />
          <RestaurantCardsSection
            city={day.overnight.city}
            lat={day.overnight.lat}
            lng={day.overnight.lng}
            answers={answers}
            preloaded={restaurantsByCity?.[day.overnight.city]}
            onToast={onToast}
          />
          {showGroceryCard && dest && (
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
        </>
      )}

      {showGroceryCard && dest && !day.overnight && !continuousDrive && (
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

      {day.activities?.length > 0 && (
        <div className="results-subsection">
          <h3 className="results-subsection-label">Things to Do and Eat</h3>
          <div className="results-activities-grid">
            {day.activities.map(item => (
              <ActivityDiningCard key={item.id} item={item} onAdd={onAddRoadStop} onToast={onToast} added={isStopAdded?.(item)}/>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
