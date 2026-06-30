import { useState } from "react";
import AmenityBadges from "./AmenityBadges.jsx";
import PlaceRatingLine from "../results/PlaceRatingLine.jsx";
import TripMappaVerifiedBadge from "../results/TripMappaVerifiedBadge.jsx";
import VintageNeonSignCard from "../signs/VintageNeonSignCard.jsx";
import { resolvePlacePhotoUrl } from "../../lib/placePhotos.js";
import { hasGooglePlacesData } from "../../lib/placesVerification.js";
import { useOnScreen } from "../../hooks/useOnScreen.js";

/** Booking.com deep links — hidden until affiliate API is live. */
const HOTEL_BOOKING_UI_ENABLED = false;

const BADGE_LABELS = {
  premium: "Premium Pick",
  bestValue: "Best Value",
  topRated: "Top Rated",
  kidFriendly: "Kid Friendly",
};

export default function HotelCard({ hotel, onSave, onToast, readOnly = false }) {
  const badges = hotel.badges || [];
  const [photoFailed, setPhotoFailed] = useState(false);
  const [photoRef, photoVisible] = useOnScreen();
  const photoSrc = photoFailed
    ? "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=192&q=80"
    : (photoVisible ? resolvePlacePhotoUrl(hotel.photo || hotel.photoUrl, 96) : null);

  function handleBook() {
    if (!hotel.bookUrl) return;
    window.open(hotel.bookUrl, "_blank", "noopener,noreferrer");
  }

  const bookLabel = "View listing";
  const bookTitle = hotel.fromGooglePlaces
    ? "Opens Google Maps or hotel website"
    : "Live booking links require Booking.com API (coming soon)";
  const showBookAction = Boolean(hotel.bookUrl) && (hotel.fromGooglePlaces || HOTEL_BOOKING_UI_ENABLED);

  function handleSave() {
    onSave?.(hotel);
    onToast?.(`Saved ${hotel.name}`);
  }

  const photo = (
    <div className="lodging-card-photo-wrap" ref={photoRef}>
      {photoSrc ? (
        <img
          className="lodging-card-photo"
          src={photoSrc}
          alt={hotel.name}
          loading="lazy"
          onError={() => setPhotoFailed(true)}
        />
      ) : (
        <div className="lodging-card-photo lodging-card-photo-placeholder" aria-hidden="true" />
      )}
      <div className="lodging-card-photo-gradient" />
      {badges.length > 0 && (
        <div className="lodging-card-badges">
          {badges.map(b => (
            <span key={b} className={`lodging-feature-badge badge-${b}`}>{BADGE_LABELS[b] || b}</span>
          ))}
        </div>
      )}
    </div>
  );

  const signExtra = hotel.neighborhood ? (
    <p className="lodging-card-neighborhood">{hotel.neighborhood}</p>
  ) : null;

  const infoRow = (
    <>
      <div className="lodging-card-stats">
        <PlaceRatingLine rating={hotel.rating} className="lodging-card-inline-rating" emptyClassName="lodging-no-reviews" />
        {hasGooglePlacesData(hotel) && <TripMappaVerifiedBadge />}
        <div className="lodging-card-price">
          {hotel.priceLabel}
          {(hotel.priceIsEstimated || !hotel.fromGooglePlaces) && (
            <span className="data-estimated-label"> Estimated</span>
          )}
        </div>
      </div>
      {hotel.amenities?.length > 0 && (
        <div className="lodging-card-amenities-wrap">
          <AmenityBadges amenityIds={hotel.amenities} />
        </div>
      )}
      {hotel.description && (
        <p className="lodging-card-desc">{hotel.description}</p>
      )}
      {hotel.distanceFromRoute != null && (
        <p className="lodging-card-distance">{hotel.distanceFromRoute} mi from route</p>
      )}
    </>
  );

  const footer = (
    <div className="lodging-card-actions lodging-card-actions-anchor">
      {showBookAction && (
        <button type="button" className="btn-generate lodging-btn-book" onClick={handleBook} title={bookTitle}>
          {bookLabel}
        </button>
      )}
      {!readOnly && (
        <button type="button" className="lodging-btn-save" onClick={handleSave}>
          Choose stay
        </button>
      )}
    </div>
  );

  return (
    <article className="lodging-card lodging-card-hotel lodging-card-premium">
      <VintageNeonSignCard
        signCategory="lodging"
        businessName={hotel.name}
        categoryLabel="Lodging"
        photo={photo}
        signExtra={signExtra}
        infoRow={infoRow}
        footer={footer}
      />
    </article>
  );
}
