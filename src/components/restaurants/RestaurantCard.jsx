import { useState } from "react";
import GoldStarRating from "./GoldStarRating.jsx";
import { dinnerOpenStatus } from "../../lib/restaurantHours.js";
import { resolvePlacePhotoUrl } from "../../lib/placePhotos.js";
import { parseRating } from "../../lib/ratings.js";
import CategoryIcon from "../icons/CategoryIcon.jsx";
import TripMappaVerifiedBadge from "../results/TripMappaVerifiedBadge.jsx";
import VintageNeonSignCard from "../signs/VintageNeonSignCard.jsx";

const SLOT_LABELS = {
  sit_down: "Sit-down pick",
  mid_range: "Mid-range pick",
  quick: "Quick bite",
};

export default function RestaurantCard({
  restaurant,
  onToast,
  estimatedArrival = null,
  onDirections = null,
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const status = dinnerOpenStatus(restaurant, estimatedArrival || new Date());
  const photoSrc = resolvePlacePhotoUrl(restaurant.photoUrl || restaurant.photo, 64);
  const rating = parseRating(restaurant.rating);

  function handleDirections(e) {
    e.stopPropagation();
    onDirections?.(restaurant);
  }

  const photo = (
    <div className="restaurant-card-photo-wrap restaurant-card-photo-thumb">
      {photoSrc && !photoFailed ? (
        <img
          className="restaurant-card-photo"
          src={photoSrc}
          alt={restaurant.name}
          loading="lazy"
          onError={() => setPhotoFailed(true)}
        />
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
  );

  const infoRow = (
    <>
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
      {restaurant.description && (
        <p className="restaurant-card-desc">{restaurant.description}</p>
      )}
    </>
  );

  const footer = (
    <div className="restaurant-card-actions">
      {(onDirections || restaurant.lat != null) && (
        <button type="button" className="restaurant-btn-directions" onClick={handleDirections}>
          Directions
        </button>
      )}
    </div>
  );

  return (
    <article className="restaurant-card">
      <VintageNeonSignCard
        signCategory="food"
        businessName={restaurant.name}
        categoryLabel="Food"
        photo={photo}
        infoRow={infoRow}
        footer={footer}
      />
    </article>
  );
}
