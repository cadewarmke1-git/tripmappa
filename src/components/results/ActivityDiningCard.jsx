import PlacePhotoOrIcon from "./PlacePhotoOrIcon.jsx";
import PlaceRatingLine from "./PlaceRatingLine.jsx";
import TripMappaVerifiedBadge from "./TripMappaVerifiedBadge.jsx";
import { hasGooglePlacesData } from "../../lib/placesVerification.js";

export default function ActivityDiningCard({ item, onAdd, added = false, onRoute = false, readOnly = false }) {
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
        {hasGooglePlacesData(item) && (
          <TripMappaVerifiedBadge className="activity-dining-verified-badge" />
        )}
      </div>
      <div className="activity-dining-body">
        <h4 className="activity-dining-name">{item.name}</h4>
        <div className="activity-dining-meta">
          <PlaceRatingLine rating={item.rating} className="activity-dining-rating" emptyClassName="activity-dining-no-reviews" />
          {item.distanceMiles != null && <span>{item.distanceMiles} mi</span>}
        </div>
        {!readOnly && (
          <button
            type="button"
            className={`activity-dining-add${added || onRoute ? " activity-dining-add-on-route" : ""}`}
            disabled={added || onRoute}
            onClick={() => { if (!added && !onRoute) onAdd?.(item); }}
          >
            {added || onRoute ? "On your route" : "Add to route"}
          </button>
        )}
      </div>
    </article>
  );
}
