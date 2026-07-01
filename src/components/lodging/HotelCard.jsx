import { useState } from "react";
import AmenityBadges from "./AmenityBadges.jsx";
import PlaceRatingLine from "../results/PlaceRatingLine.jsx";
import TripMappaVerifiedBadge from "../results/TripMappaVerifiedBadge.jsx";
import ResultsPlaceCard from "../results/ResultsPlaceCard.jsx";
import { resolvePlacePhotoUrl } from "../../lib/placePhotos.js";
import { hasGooglePlacesData } from "../../lib/placesVerification.js";
import { useOnScreen } from "../../hooks/useOnScreen.js";

/** Booking.com deep links — hidden until affiliate API is live. */
const HOTEL_BOOKING_UI_ENABLED = false;

export default function HotelCard({ hotel, onSave, onToast, readOnly = false }) {
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

  const metaParts = [
    hotel.neighborhood,
    hotel.priceLabel,
    hotel.distanceFromRoute != null ? `${hotel.distanceFromRoute} mi from route` : null,
  ].filter(Boolean);

  return (
    <ResultsPlaceCard
      signCategory="lodging"
      categoryLabel="Lodging"
      name={hotel.name}
      className="lodging-card lodging-card-hotel"
      ariaLabel={hotel.name}
      photo={(
        <div ref={photoRef}>
          {photoSrc ? (
            <img
              className="lodging-card-photo road-stop-card-photo"
              src={photoSrc}
              alt=""
              loading="lazy"
              onError={() => setPhotoFailed(true)}
            />
          ) : (
            <div className="lodging-card-photo lodging-card-photo-placeholder road-stop-card-photo-fallback" aria-hidden="true" />
          )}
        </div>
      )}
      verifiedBadge={hasGooglePlacesData(hotel) ? <TripMappaVerifiedBadge className="road-stop-verified-badge" /> : null}
      meta={(
        <>
          <div className="road-stop-card-meta lodging-card-meta-line">
            <PlaceRatingLine rating={hotel.rating} className="lodging-card-inline-rating" emptyClassName="lodging-no-reviews" />
            {metaParts.length > 0 && (
              <span className="lodging-card-meta-text">{metaParts.join(" · ")}</span>
            )}
            {(hotel.priceIsEstimated || !hotel.fromGooglePlaces) && hotel.priceLabel && (
              <span className="data-estimated-label"> Estimated</span>
            )}
          </div>
          {hotel.amenities?.length > 0 && (
            <div className="lodging-card-amenities-wrap">
              <AmenityBadges amenityIds={hotel.amenities} />
            </div>
          )}
        </>
      )}
      action={(
        <div className="lodging-card-actions lodging-card-actions-anchor road-stop-card-actions">
          {showBookAction && (
            <button type="button" className="road-stop-add-btn lodging-btn-book" onClick={handleBook} title={bookTitle}>
              {bookLabel}
            </button>
          )}
          {!readOnly && (
            <button type="button" className="road-stop-add-btn lodging-btn-save" onClick={handleSave}>
              Choose stay
            </button>
          )}
        </div>
      )}
    />
  );
}
