import GoldStarRating from "./GoldStarRating.jsx";
import { dinnerOpenStatus } from "../../lib/restaurantHours.js";
import { scalePlacesPhotoUrl } from "../../lib/placePhotos.js";
import { parseRating } from "../../lib/ratings.js";
import CategoryIcon from "../icons/CategoryIcon.jsx";
import TripMappaVerifiedBadge from "../results/TripMappaVerifiedBadge.jsx";

const SLOT_LABELS = {
  sit_down: "Sit-down pick",
  mid_range: "Mid-range pick",
  quick: "Quick bite",
};

export default function RestaurantCard({ restaurant, onToast, estimatedArrival = null }) {
  const status = dinnerOpenStatus(restaurant, estimatedArrival || new Date());
  const directionsUrl = restaurant.lat != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${restaurant.lat},${restaurant.lng}`
    : restaurant.googleMapsUrl;
  const photoSrc = scalePlacesPhotoUrl(restaurant.photoUrl, 64);
  const rating = parseRating(restaurant.rating);

  function handleDirections(e) {
    e.stopPropagation();
    if (directionsUrl) window.open(directionsUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <article className="restaurant-card">
      <div className="restaurant-card-photo-wrap restaurant-card-photo-thumb">
        {photoSrc ? (
          <img className="restaurant-card-photo" src={photoSrc} alt={restaurant.name} loading="lazy" />
        ) : (
          <div className="restaurant-card-photo-fallback" aria-hidden="true">
            <CategoryIcon category="food" />
          </div>
        )}
        <div className="restaurant-card-photo-badges">
          {restaurant.verified === true && <TripMappaVerifiedBadge />}
          {restaurant.slot && SLOT_LABELS[restaurant.slot] && (
            <span className="restaurant-slot-badge">{SLOT_LABELS[restaurant.slot]}</span>
          )}
          {restaurant.cuisineType && (
            <span className="restaurant-cuisine-badge">{restaurant.cuisineType}</span>
          )}
        </div>
      </div>

      <div className="restaurant-card-body">
        <h3 className="restaurant-card-name">{restaurant.name}</h3>
        <div className="restaurant-card-meta">
          {rating != null
            ? <GoldStarRating rating={rating} />
            : <span className="restaurant-no-reviews">No reviews yet</span>}
          <span className="restaurant-price-signs">{restaurant.priceSigns || "$$"}</span>
          {status.kind !== "closed" && (
            <span className={`restaurant-open-status ${status.className}`}>{status.label}</span>
          )}
        </div>
        {restaurant.distanceMiles != null && (
          <div className="restaurant-card-distance">{restaurant.distanceMiles} mi from stop</div>
        )}
        <p className="restaurant-card-desc">{restaurant.description}</p>
        <div className="restaurant-card-actions">
          <button type="button" className="restaurant-btn-directions" onClick={handleDirections}>
            Directions
          </button>
        </div>
      </div>
    </article>
  );
}
