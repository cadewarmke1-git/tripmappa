import PlacePhotoOrIcon from "./PlacePhotoOrIcon.jsx";
import RoadFoodStopRow from "../restaurants/RoadFoodStopRow.jsx";
import RoadTripStopCard from "./RoadTripStopCard.jsx";
import { parseRating } from "../../lib/ratings.js";
import { hasGooglePlacesData } from "../../lib/placesVerification.js";
import { roadStopToSignCategory, signCategoryLabel } from "../../lib/neonSignCategory.js";
import { buildDirectionsUrl, formatOffRouteDistance } from "../../lib/stopCardDistance.js";

function prefersPhotoFallback(category, source) {
  if (source === "osm") return true;
  const cat = String(category || "").toLowerCase();
  return !/fuel|gas|charg|truck|rest_area|diesel|ev/.test(cat);
}

function isFoodOrFuelCategory(category) {
  const signCategory = roadStopToSignCategory(category);
  return signCategory === "food" || signCategory === "fuel";
}

export default function RoadStopCard({
  stop,
  onAdd,
  onRemove,
  onSelect,
  highlighted = false,
  cardRef,
  added = false,
  onRoute = false,
  showTruckWarnings = false,
  readOnly = false,
}) {
  const isCharging = String(stop.category || "").toLowerCase() === "charging";
  const charging = stop.charging || stop.stopData;
  const rating = parseRating(stop.rating);
  const stopData = stop.stopData || stop;
  const verified = hasGooglePlacesData(stopData);
  const includedOnRoute = onRoute || added;
  const signCategory = roadStopToSignCategory(stop.category);
  const categoryLabel = signCategoryLabel(signCategory, stop.category || "Stop");
  const showTruckParkingWarning = showTruckWarnings && stopData.truckParking === false
    && /food|rest|dining/i.test(String(stop.category || ""));

  const lat = stop.lat ?? stopData.lat;
  const lng = stop.lng ?? stopData.lng;
  const directionsUrl = buildDirectionsUrl(lat, lng);
  const distance = formatOffRouteDistance(stop.distanceFromRoute);

  function handleDirections() {
    if (onSelect) {
      onSelect(stop);
      return;
    }
    if (directionsUrl) {
      window.open(directionsUrl, "_blank", "noopener,noreferrer");
    }
  }

  function handleRouteToggle() {
    if (includedOnRoute) onRemove?.(stop);
    else onAdd?.(stop);
  }

  const actions = [];
  if (isFoodOrFuelCategory(stop.category) || signCategory === "general") {
    if (onSelect || directionsUrl) {
      actions.push({
        label: "Get directions",
        variant: "primary",
        onClick: handleDirections,
      });
    }
  }

  if (!readOnly) {
    actions.push({
      label: includedOnRoute ? "On your route" : "Add to route",
      variant: actions.length === 0 ? "primary" : "secondary",
      onClick: handleRouteToggle,
      disabled: includedOnRoute,
    });
  } else if (includedOnRoute) {
    actions.push({
      label: "On your route",
      variant: "secondary",
      disabled: true,
    });
  }

  const metaExtra = (
    <>
      {isCharging && (
        <span className="road-stop-charging-meta-inline">
          {[
            charging?.network || stop.stopData?.network,
            charging?.level || stop.stopData?.chargerTypes?.join(" · "),
            charging?.chargeTime80 || stop.stopData?.chargeTime80
              ? `${charging?.chargeTime80 || stop.stopData?.chargeTime80} to 80%`
              : null,
            charging?.ports != null || stop.stopData?.ports != null
              ? `${charging?.ports ?? stop.stopData?.ports} ports`
              : null,
          ].filter(Boolean).join(" · ")}
        </span>
      )}
      {stop.source === "osm" && (
        <span className="road-stop-osm-badge">Highway facility</span>
      )}
      {Array.isArray(stop.amenities) && stop.amenities.length > 0 && (
        <span className="road-stop-amenity-tags">{stop.amenities.join(" · ")}</span>
      )}
      {showTruckParkingWarning && (
        <span className="road-stop-truck-warning" title="No verified truck parking at this stop">
          Limited truck parking
        </span>
      )}
      {stop.localFavorite && (
        <span className="road-stop-badge-local-inline">Local Favorite</span>
      )}
    </>
  );

  return (
    <RoadTripStopCard
      signCategory={signCategory}
      categoryLabel={categoryLabel}
      name={stop.title}
      highlighted={highlighted}
      cardRef={cardRef}
      className={`road-stop-card--${signCategory}`}
      ariaLabel={`${stop.title || "Stop"}${stop.category ? `, ${stop.category}` : ""}`}
      onCardClick={() => onSelect?.(stop)}
      rating={rating}
      distance={distance}
      verified={verified}
      metaExtra={metaExtra}
      actions={actions}
      photo={(
        <PlacePhotoOrIcon
          photoUrl={stop.photoUrl}
          name={stop.title}
          category={stop.category}
          imgClassName="road-stop-card-photo"
          className="road-stop-card-photo-fallback"
          displayPx={64}
          preferFallback={prefersPhotoFallback(stop.category, stop.source)}
        />
      )}
    >
      {stop.category?.toLowerCase() === "food" && stop.nearbyRestaurants?.length > 0 && (
        <div className="road-food-stops">
          {stop.nearbyRestaurants.map(r => (
            <RoadFoodStopRow key={r.placeId || r.id || r.name} restaurant={r} />
          ))}
        </div>
      )}
    </RoadTripStopCard>
  );
}
