import { useState } from "react";
import AmenityBadges from "./AmenityBadges.jsx";
import RoadTripStopCard from "../results/RoadTripStopCard.jsx";
import { resolvePlacePhotoUrl } from "../../lib/placePhotos.js";
import { hasGooglePlacesData } from "../../lib/placesVerification.js";
import { useOnScreen } from "../../hooks/useOnScreen.js";
import { parseRating } from "../../lib/ratings.js";
import { buildDirectionsUrl, formatOffRouteDistance } from "../../lib/stopCardDistance.js";

/** Build Booking.com search URL from hotel name + city. */
function buildBookingSearchUrl(hotelName, city) {
  const name = hotelName?.trim();
  const cityName = city?.split(",")[0]?.trim() || city?.trim();
  if (!name || !cityName) return null;
  // BOOKING_COM_PLACEHOLDER — replace with affiliate API when ready
  const ss = `${name}+${cityName}`.replace(/\s+/g, "+");
  return `https://www.booking.com/search.html?ss=${ss}`;
}

export default function HotelCard({
  hotel,
  city,
  onSave,
  onToast,
  onRemove,
  readOnly = false,
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const [photoRef, photoVisible] = useOnScreen();
  const photoSrc = photoFailed
    ? "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=192&q=80"
    : (photoVisible ? resolvePlacePhotoUrl(hotel.photo || hotel.photoUrl, 96) : null);

  const bookingSearchUrl = buildBookingSearchUrl(hotel.name, city);
  const directionsUrl = buildDirectionsUrl(hotel.lat, hotel.lng);

  function handleViewListing() {
    if (!bookingSearchUrl) return;
    window.open(bookingSearchUrl, "_blank", "noopener,noreferrer");
  }

  function handleChooseStay() {
    if (bookingSearchUrl) {
      window.open(bookingSearchUrl, "_blank", "noopener,noreferrer");
    }
    onSave?.(hotel);
    onToast?.(`Saved ${hotel.name}`);
  }

  const rating = parseRating(hotel.rating);
  const distance = formatOffRouteDistance(hotel.distanceFromRoute)
    || (hotel.neighborhood ? `${hotel.neighborhood}` : null);

  const metaExtra = (
    <>
      {hotel.priceLabel && (
        <span className="lodging-card-meta-text">{hotel.priceLabel}</span>
      )}
      {(hotel.priceIsEstimated || !hotel.fromGooglePlaces) && hotel.priceLabel && (
        <span className="data-estimated-label"> Estimated</span>
      )}
      {hotel.amenities?.length > 0 && (
        <span className="lodging-card-amenities-wrap">
          <AmenityBadges amenityIds={hotel.amenities} />
        </span>
      )}
    </>
  );

  const actions = [];
  if (!readOnly) {
    actions.push({
      label: "Choose stay",
      variant: "primary",
      onClick: handleChooseStay,
    });
  }
  if (bookingSearchUrl) {
    actions.push({
      label: "View listing",
      variant: readOnly ? "primary" : "secondary",
      onClick: handleViewListing,
      title: "Opens Booking.com search",
    });
  }
  if (directionsUrl) {
    actions.push({
      label: "Get directions",
      variant: "secondary",
      href: directionsUrl,
    });
  }

  return (
    <RoadTripStopCard
      signCategory="lodging"
      categoryLabel="Lodging"
      name={hotel.name}
      className="lodging-card lodging-card-hotel"
      ariaLabel={hotel.name}
      rating={rating}
      distance={distance}
      verified={hasGooglePlacesData(hotel)}
      metaExtra={metaExtra}
      actions={actions}
      onRemove={!readOnly && onRemove ? () => onRemove(hotel) : null}
      removeLabel={`Remove ${hotel.name}`}
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
    />
  );
}
