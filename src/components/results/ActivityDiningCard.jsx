import { formatStarLabel } from "../../lib/ratings.js";

const PLACEHOLDER = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&q=80";

export default function ActivityDiningCard({ item, onAdd }) {
  return (
    <article className="activity-dining-card">
      <div className="activity-dining-photo-wrap">
        <img src={item.photoUrl || PLACEHOLDER} alt="" className="activity-dining-photo" loading="lazy"/>
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
        <button type="button" className="activity-dining-add" onClick={() => onAdd?.(item)}>Add to Trip</button>
      </div>
    </article>
  );
}
