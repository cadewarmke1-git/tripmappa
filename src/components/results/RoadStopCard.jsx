import PlacePhotoOrIcon from "./PlacePhotoOrIcon.jsx";
import RoadFoodStopRow from "../restaurants/RoadFoodStopRow.jsx";
import PlaceRatingLine from "./PlaceRatingLine.jsx";
import TripMappaVerifiedBadge from "./TripMappaVerifiedBadge.jsx";

export default function RoadStopCard({
  stop,
  onAdd,
  onRemove,
  onSelect,
  highlighted = false,
  cardRef,
  added = false,
  showTruckWarnings = false,
}) {
  const isCharging = String(stop.category || "").toLowerCase() === "charging";
  const charging = stop.charging || stop.stopData;
  const showTruckParkingWarning = showTruckWarnings && stop.truckParking === false
    && /food|rest|dining/i.test(String(stop.category || ""));
  function handleClick() {
    onSelect?.(stop);
  }

  function handleAdd(e) {
    e.stopPropagation();
    if (added) return;
    onAdd?.(stop);
  }

  function handleRemove(e) {
    e.stopPropagation();
    if (!added) return;
    onRemove?.(stop);
  }

  return (
    <article
      ref={cardRef}
      className={`road-stop-card${highlighted ? " stop-highlighted" : ""}`}
      data-stop-id={stop.id}
      onClick={handleClick}
      onKeyDown={e => { if (e.key === "Enter") handleClick(); }}
      role="button"
      tabIndex={0}
    >
      <div className="road-stop-card-photo-wrap road-stop-card-photo-thumb">
        <PlacePhotoOrIcon
          photoUrl={stop.photoUrl}
          category={stop.category}
          imgClassName="road-stop-card-photo"
          className="road-stop-card-photo-fallback"
          displayPx={64}
        />
        {stop.verified === true && <TripMappaVerifiedBadge className="road-stop-verified-badge" />}
        {stop.localFavorite && <span className="road-stop-badge-local">Local Favorite</span>}
        <span className={`road-stop-badge-cat${isCharging ? " road-stop-badge-charging" : ""}`}>
          {stop.category || "Stop"}
        </span>
      </div>
      <div className="road-stop-card-body">
        <h4 className="road-stop-card-name">{stop.title}</h4>
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
          <PlaceRatingLine rating={stop.rating} className="road-stop-rating" emptyClassName="road-stop-no-reviews" />
          {stop.distanceFromRoute != null && (
            <span>{typeof stop.distanceFromRoute === "number" ? `${stop.distanceFromRoute} mi` : stop.distanceFromRoute}</span>
          )}
          {showTruckParkingWarning && (
            <span className="road-stop-truck-warning" title="No verified truck parking at this stop">
              Limited truck parking
            </span>
          )}
        </div>
        <button
          type="button"
          className={`road-stop-add-btn${added ? " road-stop-add-btn-added" : ""}`}
          disabled={!added && false}
          onClick={added ? handleRemove : handleAdd}
        >
          {added ? "Remove from trip" : "Add to Trip"}
        </button>
        {stop.category?.toLowerCase() === "food" && stop.nearbyRestaurants?.length > 0 && (
          <div className="road-food-stops">
            {stop.nearbyRestaurants.map(r => (
              <RoadFoodStopRow key={r.placeId || r.id || r.name} restaurant={r} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
