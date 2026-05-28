import { useEffect, useState } from "react";
import { fetchRestaurantsForStop } from "../../lib/restaurantsClient.js";
import { selectDisplayRestaurants } from "../../lib/restaurantPlaces.js";
import RestaurantCard from "./RestaurantCard.jsx";
import RestaurantCardSkeleton from "./RestaurantCardSkeleton.jsx";

export default function RestaurantCardsSection({ city, lat, lng, answers, preloaded = null, onToast }) {
  const [loading, setLoading] = useState(!preloaded?.length);
  const [restaurants, setRestaurants] = useState(() => (preloaded?.length ? selectDisplayRestaurants(preloaded) : []));

  useEffect(() => {
    if (preloaded?.length) {
      setRestaurants(selectDisplayRestaurants(preloaded));
      setLoading(false);
      return undefined;
    }
    if (!city || lat == null || lng == null) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const list = await fetchRestaurantsForStop({ lat, lng, city, answers, limit: 6 });
      if (!cancelled) {
        setRestaurants(selectDisplayRestaurants(list));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [city, lat, lng, answers, preloaded]);

  if (!city) return null;

  return (
    <div className="restaurant-section">
      <div className="restaurant-section-label">Where to eat tonight</div>
      {loading ? (
        <div className="restaurant-cards-scroll">
          {Array.from({ length: 3 }, (_, i) => <RestaurantCardSkeleton key={i} />)}
        </div>
      ) : restaurants.length === 0 ? (
        <div className="restaurant-empty">No restaurants found nearby — try adjusting your dining preferences.</div>
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
