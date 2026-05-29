import { formatStarLabel } from "../../lib/ratings.js";
import PlacePhotoOrIcon from "./PlacePhotoOrIcon.jsx";
import StopLocationActions from "./StopLocationActions.jsx";

export default function ActivityDiningCard({ item, onAdd, onToast, added = false }) {
  return (
    <article className="activity-dining-card">
      <div className="activity-dining-photo-wrap">
        <PlacePhotoOrIcon
          photoUrl={item.photoUrl}
          name={item.name}
          category={item.category}
          imgClassName="activity-dining-photo"
          className="activity-dining-photo-fallback"
        />
        <span className="activity-dining-cat">{item.category}</span>
      </div>
      <div className="activity-dining-body">
        <h4 className="activity-dining-name">{item.name}</h4>
        <div className="activity-dining-meta">
          {formatStarLabel(item.rating)
            ? <span className="activity-dining-rating">{formatStarLabel(item.rating)}</span>
            : <span className="activity-dining-no-reviews">No reviews yet</span>}
          {item.distanceMiles != null && <span>{item.distanceMiles} mi</span>}
        </div>
        <StopLocationActions stop={item} onToast={onToast} compact />
        <button
          type="button"
          className="activity-dining-add"
          disabled={added}
          onClick={() => { if (!added) onAdd?.(item); }}
        >
          {added ? "Added" : "Add to Trip"}
        </button>
      </div>
    </article>
  );
}
