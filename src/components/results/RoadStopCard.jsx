import PlacePhotoOrIcon from "./PlacePhotoOrIcon.jsx";
import RoadFoodStopRow from "../restaurants/RoadFoodStopRow.jsx";
import InlineStarRating from "./InlineStarRating.jsx";

export default function RoadStopCard({ stop, onAdd, onSelect, highlighted = false, cardRef, added = false }) {
  function handleClick() {
    onSelect?.(stop);
  }

  function handleAdd(e) {
    e.stopPropagation();
    if (added) return;
    onAdd?.(stop);
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
          {stop.rating != null
            ? <InlineStarRating rating={stop.rating} className="road-stop-rating" />
            : <span className="road-stop-no-reviews">No reviews yet</span>}
          {stop.distanceFromRoute != null && (
            <span>{typeof stop.distanceFromRoute === "number" ? `${stop.distanceFromRoute} mi` : stop.distanceFromRoute}</span>
          )}
        </div>
        <button
          type="button"
          className="road-stop-add-btn"
          disabled={added}
          onClick={handleAdd}
        >
          {added ? "Added" : "Add to Trip"}
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
