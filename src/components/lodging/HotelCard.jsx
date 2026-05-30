import { useState } from "react";
import AmenityBadges from "./AmenityBadges.jsx";
import InlineStarRating from "../results/InlineStarRating.jsx";

const BADGE_LABELS = {
  premium: "Premium Pick",
  bestValue: "Best Value",
  topRated: "Top Rated",
  kidFriendly: "Kid Friendly",
};

export default function HotelCard({ hotel, onSave, onToast }) {
  const badges = hotel.badges || [];
  const [photoFailed, setPhotoFailed] = useState(false);
  const photoSrc = photoFailed
    ? "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80"
    : hotel.photo;

  function handleBook() {
    if (!hotel.bookUrl) return;
    window.open(hotel.bookUrl, "_blank", "noopener,noreferrer");
  }

  const bookLabel = hotel.fromGooglePlaces ? "View listing" : "View listing (soon)";
  const bookTitle = hotel.fromGooglePlaces
    ? "Opens Google Maps or hotel website"
    : "Live booking links require Booking.com API (coming soon)";

  function handleSave() {
    onSave?.(hotel);
    onToast?.(`Saved ${hotel.name}`);
  }

  return (
    <article className="lodging-card lodging-card-hotel lodging-card-premium">
      <div className="lodging-card-photo-wrap">
        <img
          className="lodging-card-photo"
          src={photoSrc}
          alt={hotel.name}
          loading="lazy"
          onError={() => setPhotoFailed(true)}
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

      <div className="lodging-card-body lodging-card-body-premium">
        <div className="lodging-card-primary">
          <h3 className="lodging-card-name">{hotel.name}</h3>
          {hotel.neighborhood && (
            <p className="lodging-card-neighborhood">{hotel.neighborhood}</p>
          )}
          <div className="lodging-card-stats">
            {hotel.rating != null && (
              <InlineStarRating rating={hotel.rating} className="lodging-card-inline-rating" />
            )}
            <div className="lodging-card-price">{hotel.priceLabel}</div>
          </div>
          {hotel.amenities?.length > 0 && (
            <div className="lodging-card-amenities-wrap">
              <AmenityBadges amenityIds={hotel.amenities} />
            </div>
          )}
        </div>

        <div className="lodging-card-secondary">
          {hotel.description && (
            <p className="lodging-card-desc">{hotel.description}</p>
          )}
          {hotel.distanceFromRoute != null && (
            <p className="lodging-card-distance">{hotel.distanceFromRoute} mi from route</p>
          )}
        </div>

        <div className="lodging-card-actions lodging-card-actions-anchor">
          <button type="button" className="btn-generate lodging-btn-book" onClick={handleBook} title={bookTitle}>
            {bookLabel}
          </button>
          <button type="button" className="lodging-btn-save" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </article>
  );
}
