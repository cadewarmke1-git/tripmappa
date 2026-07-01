import PlacePhotoOrIcon from "./PlacePhotoOrIcon.jsx";
import RoadFoodStopRow from "../restaurants/RoadFoodStopRow.jsx";
import PlaceRatingLine from "./PlaceRatingLine.jsx";
import TripMappaVerifiedBadge from "./TripMappaVerifiedBadge.jsx";
import ResultsPlaceCard from "./ResultsPlaceCard.jsx";
import { parseRating } from "../../lib/ratings.js";
import { hasGooglePlacesData } from "../../lib/placesVerification.js";
import { roadStopToSignCategory, signCategoryLabel } from "../../lib/neonSignCategory.js";

function prefersPhotoFallback(category, source) {
  if (source === "osm") return true;
  const cat = String(category || "").toLowerCase();
  return !/fuel|gas|charg|truck|rest_area|diesel|ev/.test(cat);
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
  const hasRating = parseRating(stop.rating) != null;
  const stopData = stop.stopData || stop;
  const showVerifiedBadge = hasGooglePlacesData(stopData);
  const includedOnRoute = onRoute || added;
  const signCategory = roadStopToSignCategory(stop.category);
  const categoryLabel = signCategoryLabel(signCategory, stop.category || "Stop");
  const showTruckParkingWarning = showTruckWarnings && stopData.truckParking === false
    && /food|rest|dining/i.test(String(stop.category || ""));

  function handleClick() {
    onSelect?.(stop);
  }

  function handleRouteToggle(e) {
    e.stopPropagation();
    if (includedOnRoute) onRemove?.(stop);
    else onAdd?.(stop);
  }

  const cardLabel = `${stop.title || "Stop"}${stop.category ? `, ${stop.category}` : ""}`;

  return (
    <ResultsPlaceCard
      signCategory={signCategory}
      categoryLabel={categoryLabel}
      name={stop.title}
      highlighted={highlighted}
      cardRef={cardRef}
      className={`road-stop-card--${signCategory}`}
      ariaLabel={cardLabel}
      onClick={handleClick}
      photo={(
        <>
          <PlacePhotoOrIcon
            photoUrl={stop.photoUrl}
            name={stop.title}
            category={stop.category}
            imgClassName="road-stop-card-photo"
            className="road-stop-card-photo-fallback"
            displayPx={64}
            preferFallback={prefersPhotoFallback(stop.category, stop.source)}
          />
          {showVerifiedBadge && <TripMappaVerifiedBadge className="road-stop-verified-badge" />}
          {stop.localFavorite && <span className="road-stop-badge-local">Local Favorite</span>}
        </>
      )}
      meta={(
        <>
          {isCharging && (
            <p className="road-stop-charging-meta">
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
            </p>
          )}
          <div className="road-stop-card-meta">
            {stop.source === "osm" ? (
              <span className="road-stop-osm-badge">Highway facility</span>
            ) : hasRating ? (
              <PlaceRatingLine rating={stop.rating} className="road-stop-rating" />
            ) : null}
            {Array.isArray(stop.amenities) && stop.amenities.length > 0 && (
              <span className="road-stop-amenity-tags">{stop.amenities.join(" · ")}</span>
            )}
            {stop.distanceFromRoute != null && (
              <span>{typeof stop.distanceFromRoute === "number" ? `${stop.distanceFromRoute} mi` : stop.distanceFromRoute}</span>
            )}
            {showTruckParkingWarning && (
              <span className="road-stop-truck-warning" title="No verified truck parking at this stop">
                Limited truck parking
              </span>
            )}
          </div>
        </>
      )}
      action={!readOnly ? (
        <button
          type="button"
          className={`road-stop-add-btn${includedOnRoute ? " road-stop-add-btn-added road-stop-on-route-btn" : ""}`}
          onClick={handleRouteToggle}
        >
          {includedOnRoute ? "On your route" : "Add to route"}
        </button>
      ) : includedOnRoute ? (
        <span className="road-stop-on-route-label">On route</span>
      ) : null}
    >
      {stop.category?.toLowerCase() === "food" && stop.nearbyRestaurants?.length > 0 && (
        <div className="road-food-stops">
          {stop.nearbyRestaurants.map(r => (
            <RoadFoodStopRow key={r.placeId || r.id || r.name} restaurant={r} />
          ))}
        </div>
      )}
    </ResultsPlaceCard>
  );
}
