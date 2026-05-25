import StarRating from "./StarRating.jsx";
import AmenityBadges from "./AmenityBadges.jsx";

const BADGE_LABELS = {
  premium: "Premium Pick",
  bestValue: "Best Value",
  topRated: "Top Rated",
  kidFriendly: "Kid Friendly",
};

export default function HotelCard({ hotel, onSave, onToast }) {
  const badges = hotel.badges || [];

  function handleBook() {
    window.open(hotel.bookUrl, "_blank", "noopener,noreferrer");
  }

  function handleSave() {
    onSave?.(hotel);
    onToast?.(`Saved ${hotel.name}`);
  }

  return (
    <article className="lodging-card lodging-card-hotel">
      <div className="lodging-card-photo-wrap">
        <img
          className="lodging-card-photo"
          src={hotel.photo}
          alt={hotel.name}
          loading="lazy"
        />
        <div className="lodging-card-photo-gradient" />
        {badges.length > 0 && (
          <div className="lodging-card-badges">
            {badges.map(b => (
              <span key={b} className={`lodging-feature-badge badge-${b}`}>{BADGE_LABELS[b] || b}</span>
            ))}
          </div>
        )}
      </div>

      <div className="lodging-card-body">
        <h3 className="lodging-card-name">{hotel.name}</h3>
        <StarRating stars={hotel.stars} />
        <p className="lodging-card-neighborhood">{hotel.neighborhood}</p>
        <div className="lodging-card-price">{hotel.priceLabel}</div>
        <AmenityBadges amenityIds={hotel.amenities} />
        <p className="lodging-card-desc">{hotel.description}</p>
        <p className="lodging-card-distance">{hotel.distanceFromRoute} mi from route</p>

        <div className="lodging-card-actions">
          <button type="button" className="btn-generate lodging-btn-book" onClick={handleBook}>
            Book Now
          </button>
          <button type="button" className="lodging-btn-save" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </article>
  );
}
