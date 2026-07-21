import PlacePhotoOrIcon from "./PlacePhotoOrIcon.jsx";
import RoadTripStopCard from "./RoadTripStopCard.jsx";
import { hasGooglePlacesData } from "../../lib/placesVerification.js";
import { parseRating } from "../../lib/ratings.js";
import { roadStopToSignCategory, signCategoryLabel } from "../../lib/neonSignCategory.js";
import { buildDirectionsUrl, formatOffRouteDistance } from "../../lib/stopCardDistance.js";

export default function ActivityDiningCard({
  item,
  onAdd,
  onRemove,
  added = false,
  onRoute = false,
  readOnly = false,
}) {
  const signCategory = roadStopToSignCategory(item.category || "food");
  const categoryLabel = signCategoryLabel(signCategory, item.category || "Activity");
  const includedOnRoute = onRoute || added;
  const rating = parseRating(item.rating);
  const distance = formatOffRouteDistance(item.distanceMiles)
    || (item.distanceMiles != null ? `${item.distanceMiles} mi from route` : null);
  const directionsUrl = buildDirectionsUrl(item.lat, item.lng);

  const actions = [];
  if (directionsUrl) {
    actions.push({
      label: "Get directions",
      variant: "primary",
      href: directionsUrl,
    });
  }
  if (!readOnly) {
    actions.push({
      label: includedOnRoute ? "On your route" : "Add to route",
      variant: actions.length === 0 ? "primary" : "secondary",
      disabled: includedOnRoute,
      onClick: () => { if (!includedOnRoute) onAdd?.(item); },
    });
  }

  return (
    <RoadTripStopCard
      signCategory={signCategory}
      categoryLabel={categoryLabel}
      name={item.name}
      className="activity-dining-card"
      ariaLabel={item.name}
      rating={rating}
      distance={distance}
      verified={hasGooglePlacesData(item)}
      actions={actions}
      onRemove={!readOnly && onRemove ? () => onRemove(item) : null}
      photo={(
        <PlacePhotoOrIcon
          photoUrl={item.photoUrl}
          name={item.name}
          category={item.category}
          imgClassName="road-stop-card-photo"
          className="road-stop-card-photo-fallback"
          displayPx={64}
        />
      )}
    />
  );
}
