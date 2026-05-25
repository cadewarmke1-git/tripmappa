import { formatStarLabel } from "../../lib/ratings.js";

const PLACEHOLDER = "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&q=80";

export default function RoadStopCard({ stop, onAdd }) {
  const photo = stop.photoUrl || PLACEHOLDER;

  return (
    <article className="road-stop-card">
      <div className="road-stop-card-photo-wrap">
        <img src={photo} alt="" className="road-stop-card-photo" loading="lazy"/>
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
