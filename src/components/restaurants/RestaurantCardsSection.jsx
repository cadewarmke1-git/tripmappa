import { useEffect, useState } from "react";
import { fetchRestaurantsForStop } from "../../lib/restaurantsClient.js";
import { selectDisplayRestaurants } from "../../lib/restaurantPlaces.js";
import RestaurantCard from "./RestaurantCard.jsx";
import RestaurantCardSkeleton from "./RestaurantCardSkeleton.jsx";

export default function RestaurantCardsSection({ city, lat, lng, answers, preloaded, onToast }) {
  const hasPreload = preloaded !== undefined && preloaded !== null;
  const [loading, setLoading] = useState(!hasPreload);
  const [restaurants, setRestaurants] = useState(() => (
    hasPreload ? selectDisplayRestaurants(Array.isArray(preloaded) ? preloaded : []) : []
  ));
  const [status, setStatus] = useState(() => {
    if (hasPreload) {
      const list = Array.isArray(preloaded) ? preloaded : [];
      return list.length ? "ready" : "empty";
    }
    return "loading";
  });

  useEffect(() => {
    if (preloaded !== undefined && preloaded !== null) {
      const list = Array.isArray(preloaded) ? preloaded : [];
      setRestaurants(selectDisplayRestaurants(list));
      setLoading(false);
      setStatus(list.length ? "ready" : "empty");
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
        setRestaurants(selectDisplayRestaurants(result.restaurants));
        setStatus("ready");
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [city, lat, lng, answers, preloaded]);

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
      <div className="restaurant-section-label">Where to eat tonight</div>
      {loading ? (
        <div className="restaurant-cards-scroll">
          {Array.from({ length: 3 }, (_, i) => <RestaurantCardSkeleton key={i} />)}
        </div>
      ) : restaurants.length === 0 ? (
        <div className={`restaurant-empty restaurant-empty-${status}`}>{emptyMessage}</div>
      ) : (
        <div className="restaurant-cards-scroll">
          {restaurants.map(r => (
            <RestaurantCard key={r.placeId} restaurant={r} onToast={onToast} />
          ))}
        </div>
      )}
      <p className="restaurant-disclaimer">Hours and availability may vary — check before you go.</p>
    </div>
  );
}
