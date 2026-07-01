import { useState } from "react";
import { dinnerOpenStatus } from "../../lib/restaurantHours.js";
import { resolvePlacePhotoUrl } from "../../lib/placePhotos.js";
import { parseRating } from "../../lib/ratings.js";
import CategoryIcon from "../icons/CategoryIcon.jsx";
import TripMappaVerifiedBadge from "../results/TripMappaVerifiedBadge.jsx";
import ResultsPlaceCard from "../results/ResultsPlaceCard.jsx";
import { hasGooglePlacesData } from "../../lib/placesVerification.js";

const SLOT_LABELS = {
  sit_down: "Dinner",
  mid_range: "Dinner",
  quick: "Quick meal",
};

export default function RestaurantCard({
  restaurant,
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

  const slotLabel = restaurant.slot ? SLOT_LABELS[restaurant.slot] : null;
  const metaLine = [
    slotLabel,
    restaurant.cuisineType,
    restaurant.priceSigns || "$$",
    rating != null ? `${rating}★` : null,
    status.kind !== "closed" ? status.label : null,
    restaurant.distanceMiles != null ? `${restaurant.distanceMiles} mi from stop` : null,
  ].filter(Boolean).join(" · ");

  return (
    <ResultsPlaceCard
      signCategory="food"
      categoryLabel="Food"
      name={restaurant.name}
      className="restaurant-card"
      ariaLabel={restaurant.name}
      photo={(
        photoSrc && !photoFailed ? (
          <img
            className="restaurant-card-photo road-stop-card-photo"
            src={photoSrc}
            alt=""
            loading="lazy"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <div className="restaurant-card-photo-fallback road-stop-card-photo-fallback" aria-hidden="true">
            <CategoryIcon category="food" />
          </div>
        )
      )}
      verifiedBadge={hasGooglePlacesData(restaurant) ? <TripMappaVerifiedBadge className="road-stop-verified-badge" /> : null}
      meta={(
        <div className="road-stop-card-meta restaurant-card-meta-line">
          {metaLine ? (
            <span className="restaurant-meta-oneline">{metaLine}</span>
          ) : (
            <span className="restaurant-no-reviews">No reviews yet</span>
          )}
        </div>
      )}
      action={(
        (onDirections || restaurant.lat != null) ? (
          <div className="restaurant-card-actions road-stop-card-actions">
            <button type="button" className="road-stop-add-btn restaurant-btn-directions" onClick={handleDirections}>
              Directions
            </button>
          </div>
        ) : null
      )}
    />
  );
}
