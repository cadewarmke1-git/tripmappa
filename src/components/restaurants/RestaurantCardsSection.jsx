import { useEffect, useState } from "react";
import { fetchRestaurantsForStop } from "../../lib/restaurantsClient.js";
import { selectDisplayRestaurants } from "../../lib/restaurantPlaces.js";
import RestaurantCard from "./RestaurantCard.jsx";
import RestaurantCardSkeleton from "./RestaurantCardSkeleton.jsx";

export default function RestaurantCardsSection({ city, lat, lng, answers, preloaded = null, onToast }) {
  const [loading, setLoading] = useState(!preloaded?.length);
  const [restaurants, setRestaurants] = useState(() => (preloaded?.length ? selectDisplayRestaurants(preloaded) : []));
  const [status, setStatus] = useState(preloaded?.length ? "ready" : "loading");

  useEffect(() => {
    if (preloaded?.length) {
      setRestaurants(selectDisplayRestaurants(preloaded));
      setLoading(false);
      setStatus("ready");
      return undefined;
    }
    if (!city) {
      setLoading(false);
      setStatus("missing");
      return undefined;
    }
    if (lat == null || lng == null) {
      setLoading(false);
      setStatus("missing-location");
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setStatus("loading");
    (async () => {
      const result = await fetchRestaurantsForStop({ lat, lng, city, answers, limit: 6 });
      if (cancelled) return;
      if (result.error) {
        setRestaurants([]);
        setStatus(result.error === "unavailable" ? "unavailable" : "failed");
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
