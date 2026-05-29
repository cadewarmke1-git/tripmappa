const PLACEHOLDER_HERO = "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80";

export default function ItineraryStopCard({ item, onAction, onFocusMap, index = 0 }) {
  const isOvernight = item.type === "overnight";
  const isRoad = item.type === "road" || item.type === "discovery";
  const photo = item.photoUrl || PLACEHOLDER_HERO;

  function handleAction() {
    onAction?.(item);
    if (item.lat != null && item.lng != null) onFocusMap?.(item);
  }

  return (
    <article
      className={`itinerary-card itinerary-card-${item.type}${isOvernight ? " itinerary-card-hero" : ""}`}
      style={{ animationDelay: `${index * 0.08}s` }}
      onClick={() => item.lat != null && onFocusMap?.(item)}
    >
      <div className="itinerary-card-photo-wrap">
        <img src={photo} alt="" className="itinerary-card-photo" loading="lazy"/>
        <div className="itinerary-card-photo-gradient"/>
        {item.localFavorite && <span className="itinerary-badge-local">Local Favorite</span>}
        {item.type === "departure" && <span className="itinerary-badge-type">Departure</span>}
        {item.type === "arrival" && <span className="itinerary-badge-type">Arrival</span>}
        {isOvernight && <span className="itinerary-badge-type">Overnight</span>}
      </div>
      <div className="itinerary-card-body">
        <h3 className="itinerary-card-title">{item.title}</h3>
        <p className="itinerary-card-desc">{item.description}</p>
        <div className="itinerary-card-meta">
          {item.distance && <span>{item.distance}</span>}
          {item.eta && <span>{item.eta}</span>}
          {item.rating != null && <span>{item.rating} / 5</span>}
          {item.detourMiles != null && <span>+{item.detourMiles} mi detour</span>}
        </div>
        <div className="itinerary-card-actions">
          {item.action === "book" && (
            <button type="button" className="btn-generate itinerary-btn-gold" onClick={e => { e.stopPropagation(); handleAction(); }}>
              Book Now
            </button>
          )}
          {item.action === "add" && (
            <button type="button" className="itinerary-btn-secondary" onClick={e => { e.stopPropagation(); handleAction(); }}>
              Add to Trip
            </button>
          )}
          {(item.action === "directions" || item.lat != null) && (
            <button type="button" className="itinerary-btn-ghost" onClick={e => { e.stopPropagation(); onFocusMap?.(item); }}>
              Get Directions
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
