import { useState } from "react";
import { dinnerOpenStatus } from "../../lib/restaurantHours.js";
import { resolvePlacePhotoUrl } from "../../lib/placePhotos.js";
import { parseRating } from "../../lib/ratings.js";
import CategoryIcon from "../icons/CategoryIcon.jsx";
import RoadTripStopCard from "../results/RoadTripStopCard.jsx";
import { hasGooglePlacesData } from "../../lib/placesVerification.js";
import { buildDirectionsUrl, formatOffRouteDistance } from "../../lib/stopCardDistance.js";

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
  const directionsUrl = buildDirectionsUrl(restaurant.lat, restaurant.lng);

  function handleDirections() {
    if (onDirections) {
      onDirections(restaurant);
      return;
    }
    if (directionsUrl) {
      window.open(directionsUrl, "_blank", "noopener,noreferrer");
    }
  }

  const slotLabel = restaurant.slot ? SLOT_LABELS[restaurant.slot] : null;
  const distance = formatOffRouteDistance(restaurant.distanceMiles)
    || (restaurant.distanceMiles != null ? `${restaurant.distanceMiles} mi from stop` : null);

  const metaExtra = (
    <>
      {slotLabel && <span>{slotLabel}</span>}
      {restaurant.cuisineType && (
        <>
          {slotLabel && <span className="road-trip-stop-card-sep" aria-hidden>·</span>}
          <span>{restaurant.cuisineType}</span>
        </>
      )}
      {restaurant.priceSigns && (
        <>
          {(slotLabel || restaurant.cuisineType) && <span className="road-trip-stop-card-sep" aria-hidden>·</span>}
          <span>{restaurant.priceSigns}</span>
        </>
      )}
      {status.kind !== "closed" && status.label && (
        <>
          {(slotLabel || restaurant.cuisineType || restaurant.priceSigns) && (
            <span className="road-trip-stop-card-sep" aria-hidden>·</span>
          )}
          <span>{status.label}</span>
        </>
      )}
    </>
  );

  const actions = [];
  if (onDirections || directionsUrl) {
    actions.push({
      label: "Get directions",
      variant: "primary",
      onClick: handleDirections,
    });
  }
  if (restaurant.menuUrl || restaurant.menu) {
    actions.push({
      label: "Menu",
      variant: "secondary",
      href: restaurant.menuUrl || restaurant.menu,
    });
  }
  if (restaurant.website || restaurant.websiteUri) {
    actions.push({
      label: "Website",
      variant: "secondary",
      href: restaurant.website || restaurant.websiteUri,
    });
  }

  return (
    <RoadTripStopCard
      signCategory="food"
      categoryLabel="Food"
      name={restaurant.name}
      className="restaurant-card"
      ariaLabel={restaurant.name}
      rating={rating}
      distance={distance}
      verified={hasGooglePlacesData(restaurant)}
      metaExtra={metaExtra}
      actions={actions}
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
    />
  );
}
