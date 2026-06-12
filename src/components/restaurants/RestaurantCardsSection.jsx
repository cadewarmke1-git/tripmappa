import { useEffect, useState } from "react";
import { fetchRestaurantsForStop } from "../../lib/restaurantsClient.js";
import { isRestaurantPreloadInFlight, subscribeRestaurantPreload } from "../../lib/tripEnrichment.js";
import { selectDisplayRestaurants } from "../../lib/restaurantPlaces.js";
import { isOpenOrOpeningWithinTwoHours } from "../../lib/restaurantHours.js";
import RestaurantCard from "./RestaurantCard.jsx";
import RestaurantCardSkeleton from "./RestaurantCardSkeleton.jsx";

function filterOpenTonightRestaurants(list, estimatedArrival, overnightMode) {
  if (!overnightMode || !Array.isArray(list)) return list;
  const arrival = estimateArrival(estimatedArrival);
  return list.filter(r => isOpenOrOpeningWithinTwoHours(r, arrival));
}

function estimateArrival(estimatedArrival) {
  if (estimatedArrival instanceof Date && !Number.isNaN(estimatedArrival.getTime())) {
    return estimatedArrival;
  }
  if (estimatedArrival) {
    const parsed = new Date(estimatedArrival);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const dinner = new Date();
  dinner.setHours(18, 0, 0, 0);
  return dinner;
}

export default function RestaurantCardsSection({
  city, lat, lng, answers, preloaded, onToast, estimatedArrival = null,
  overnightMode = true,
  sectionLabel,
}) {
  const hasPreload = preloaded !== undefined && preloaded !== null;
  const [loading, setLoading] = useState(!hasPreload);
  const [restaurants, setRestaurants] = useState(() => {
    if (!hasPreload) return [];
    const list = filterOpenTonightRestaurants(Array.isArray(preloaded) ? preloaded : [], estimatedArrival, overnightMode);
    return selectDisplayRestaurants(list, { arrivalTime: estimateArrival(estimatedArrival) });
  });
  const [status, setStatus] = useState(() => {
    if (hasPreload) {
      const list = filterOpenTonightRestaurants(Array.isArray(preloaded) ? preloaded : [], estimatedArrival, overnightMode);
      const display = selectDisplayRestaurants(list, { arrivalTime: estimateArrival(estimatedArrival) });
      return display.length ? "ready" : "empty";
    }
    return "loading";
  });
  const [preloadRevision, setPreloadRevision] = useState(0);

  useEffect(() => subscribeRestaurantPreload(() => setPreloadRevision(n => n + 1)), []);

  useEffect(() => {
    if (preloaded !== undefined && preloaded !== null) {
      const list = filterOpenTonightRestaurants(Array.isArray(preloaded) ? preloaded : [], estimatedArrival, overnightMode);
      const display = selectDisplayRestaurants(list, { arrivalTime: estimateArrival(estimatedArrival) });
      setRestaurants(display);
      setLoading(false);
      setStatus(display.length ? "ready" : "empty");
      return undefined;
    }
    if (!city) {
      setLoading(false);
      setStatus("missing");
      return undefined;
    }
    if (lat == null || lng == null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
      setLoading(false);
      setStatus("missing-location");
      return undefined;
    }
    if (isRestaurantPreloadInFlight(city, lat, lng)) {
      setLoading(true);
      setStatus("loading");
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setStatus("loading");
    (async () => {
      const result = await fetchRestaurantsForStop({
        lat: Number(lat),
        lng: Number(lng),
        city,
        answers,
        limit: 6,
      });
      if (cancelled) return;
      if (result.error) {
        setRestaurants([]);
        setStatus(result.error === "unavailable" ? "unavailable" : result.error === "missing-location" ? "missing-location" : "failed");
      } else if (!result.restaurants.length) {
        setRestaurants([]);
        setStatus("empty");
      } else {
        const list = filterOpenTonightRestaurants(result.restaurants, estimatedArrival, overnightMode);
        const display = selectDisplayRestaurants(list, { arrivalTime: estimateArrival(estimatedArrival) });
        setRestaurants(display);
        setStatus(display.length ? "ready" : "empty");
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [city, lat, lng, answers, preloaded, preloadRevision, estimatedArrival, overnightMode]);

  if (!city) return null;

  const emptyMessage = {
    empty: "No restaurants found nearby for this destination.",
    "missing-location": "Still resolving destination coordinates for restaurant search.",
    unavailable: "Restaurant search is temporarily unavailable. Try again in a moment.",
    failed: "Could not load restaurants right now. Refresh or try again shortly.",
    missing: "Add a destination to see dining options.",
  }[status] || "No restaurants found nearby.";

  return (
    <div className="restaurant-section">
      <div className="restaurant-section-label">
        {sectionLabel || (overnightMode ? "Where to eat tonight" : "Dining near your route")}
      </div>
      {loading ? (
        <div className="restaurant-cards-scroll">
          {Array.from({ length: 3 }, (_, i) => <RestaurantCardSkeleton key={i} />)}
        </div>
      ) : restaurants.length === 0 ? (
        <div className={`restaurant-empty restaurant-empty-${status}`}>{emptyMessage}</div>
      ) : (
        <div className="restaurant-cards-scroll">
          {restaurants.map(r => (
            <RestaurantCard
              key={r.placeId}
              restaurant={r}
              estimatedArrival={estimateArrival(estimatedArrival)}
            />
          ))}
        </div>
      )}
      <p className="restaurant-disclaimer">Hours and availability may vary — check before you go.</p>
    </div>
  );
}
