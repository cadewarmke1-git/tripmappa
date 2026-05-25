import { formatStarLabel } from "../../lib/ratings.js";
import PlacePhotoOrIcon from "./PlacePhotoOrIcon.jsx";

export default function RoadStopCard({ stop, onAdd }) {
  return (
    <article className="road-stop-card">
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
        <button type="button" className="road-stop-add-btn" onClick={() => onAdd?.(stop)}>Add to Trip</button>
      </div>
    </article>
  );
}
