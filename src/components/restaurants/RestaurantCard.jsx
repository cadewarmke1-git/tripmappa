import GoldStarRating from "./GoldStarRating.jsx";
import { openStatusLabel } from "../../lib/restaurantPlaces.js";
import CategoryIcon from "../icons/CategoryIcon.jsx";

const SLOT_LABELS = {
  sit_down: "Sit-down pick",
  mid_range: "Mid-range pick",
  quick: "Quick bite",
};

export default function RestaurantCard({ restaurant, onToast }) {
  const status = openStatusLabel(restaurant.currentlyOpen ?? restaurant.openNow);
  const directionsUrl = restaurant.lat != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${restaurant.lat},${restaurant.lng}`
    : restaurant.googleMapsUrl;

  function handleDirections(e) {
    e.stopPropagation();
    if (directionsUrl) window.open(directionsUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <article className="restaurant-card">
      <div className="restaurant-card-photo-wrap">
        {restaurant.photoUrl ? (
          <img className="restaurant-card-photo" src={restaurant.photoUrl} alt={restaurant.name} loading="lazy" />
        ) : (
          <div className="restaurant-card-photo-fallback" aria-hidden="true">
            <CategoryIcon category="food" />
          </div>
        )}
        <div className="restaurant-card-photo-gradient" />
        <div className="restaurant-card-photo-badges">
          {restaurant.slot && SLOT_LABELS[restaurant.slot] && (
            <span className="restaurant-slot-badge">{SLOT_LABELS[restaurant.slot]}</span>
          )}
          {restaurant.cuisineType && (
            <span className="restaurant-cuisine-badge">{restaurant.cuisineType}</span>
          )}
          {restaurant.badges?.includes("playArea") && (
            <span className="restaurant-feature-badge">Play area</span>
          )}
          {restaurant.badges?.includes("outdoorSeating") && (
            <span className="restaurant-feature-badge">Outdoor seating</span>
          )}
        </div>
      </div>

      <div className="restaurant-card-body">
        <h3 className="restaurant-card-name">{restaurant.name}</h3>
        <div className="restaurant-card-meta">
          <GoldStarRating rating={restaurant.rating} />
          <span className="restaurant-price-signs">{restaurant.priceSigns || "$$"}</span>
          <span className={`restaurant-open-status ${status.className}`}>{status.label}</span>
        </div>
        {restaurant.distanceMiles != null && (
          <div className="restaurant-card-distance">{restaurant.distanceMiles} mi from stop</div>
        )}
        <p className="restaurant-card-desc">{restaurant.description}</p>
        <div className="restaurant-card-actions">
          <button type="button" className="restaurant-btn-directions" onClick={handleDirections}>
            Directions
          </button>
          <button type="button" className="restaurant-btn-reserve restaurant-btn-coming-soon" disabled title="OpenTable reservations coming in a future update">
            Reserve (soon)
          </button>
        </div>
      </div>
    </article>
  );
}
