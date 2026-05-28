import { formatStarLabel } from "../../lib/ratings.js";
import PlacePhotoOrIcon from "./PlacePhotoOrIcon.jsx";
import RoadFoodStopRow from "../restaurants/RoadFoodStopRow.jsx";

export default function RoadStopCard({ stop, onAdd, onSelect, highlighted = false, cardRef }) {
  function handleClick() {
    onSelect?.(stop);
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
      <div className="road-stop-card-photo-wrap">
        <PlacePhotoOrIcon
          photoUrl={stop.photoUrl}
          name={stop.title}
          category={stop.category}
          imgClassName="road-stop-card-photo"
          className="road-stop-card-photo-fallback"
        />
        {stop.localFavorite && <span className="road-stop-badge-local">Local Favorite</span>}
        <span className="road-stop-badge-cat">{stop.category || "Stop"}</span>
      </div>
      <div className="road-stop-card-body">
        <h4 className="road-stop-card-name">{stop.title}</h4>
        <div className="road-stop-card-meta">
          {formatStarLabel(stop.rating)
            ? <span className="road-stop-rating">{formatStarLabel(stop.rating)}</span>
            : <span className="road-stop-no-reviews">No reviews yet</span>}
          {stop.distanceFromRoute != null && (
            <span>{typeof stop.distanceFromRoute === "number" ? `${stop.distanceFromRoute} mi` : stop.distanceFromRoute}</span>
          )}
        </div>
        <button
          type="button"
          className="road-stop-add-btn"
          onClick={e => { e.stopPropagation(); onAdd?.(stop); }}
        >
          Add to Trip
        </button>
        {stop.category === "Food" && stop.nearbyRestaurants?.length > 0 && (
          <div className="road-food-stops">
            {stop.nearbyRestaurants.map(r => (
              <RoadFoodStopRow key={r.placeId} restaurant={r} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
