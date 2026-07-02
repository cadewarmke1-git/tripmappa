import { useCallback, useEffect, useState } from "react";
import { useDialogA11y } from "../../hooks/useDialogA11y.js";
import NeonSignPopup from "../signs/NeonSignPopup.jsx";
import { markerToSignCategory } from "../../lib/neonSignCategory.js";
import { hasGooglePlacesData } from "../../lib/placesVerification.js";
import { parseRating } from "../../lib/ratings.js";
import { resolveHotelListingUrl } from "../../lib/lodgingBookingLinks.js";

function resolveWebsiteUrl(marker, stopData) {
  return marker?.website || marker?.websiteUri || stopData?.website || stopData?.websiteUri || null;
}

function resolveMenuUrl(marker, stopData) {
  return marker?.menuUrl || marker?.menu || stopData?.menuUrl || stopData?.menu || null;
}

export default function MapInfoCard({ marker, theme = "night", onClose, onAction }) {
  const [visible, setVisible] = useState(false);
  const mode = theme === "day" ? "day" : "night";

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, [marker?.id]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(() => onClose?.(), 200);
  }, [onClose]);

  const dialogRef = useDialogA11y(Boolean(marker), handleClose, "map-info-card-title");

  if (!marker) return null;

  const stopData = marker.stopData || marker;
  const signCategory = markerToSignCategory(marker.category);
  const websiteUrl = resolveWebsiteUrl(marker, stopData);
  const menuUrl = resolveMenuUrl(marker, stopData);
  const rating = parseRating(marker.rating ?? stopData.rating);
  const verified = hasGooglePlacesData(marker);
  const bookUrl = signCategory === "lodging"
    ? resolveHotelListingUrl({
        ...stopData,
        name: marker.title,
        lat: marker.lat,
        lng: marker.lng,
        bookUrl: marker.bookUrl || stopData.bookUrl,
      })
    : null;

  function handleNavigate() {
    onAction?.("directions", marker);
  }

  function handleChooseStay() {
    if (bookUrl) {
      window.open(bookUrl, "_blank", "noopener,noreferrer");
      return;
    }
    onAction?.("book", marker);
  }

  return (
    <div
      ref={dialogRef}
      className={`map-info-card map-info-card-drawer map-info-card--neon map-info-card--${signCategory} ${mode}${visible ? " is-open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-info-card-title"
    >
      <h2 id="map-info-card-title" className="map-info-card-sr-title">{marker.title}</h2>
      <button type="button" className="map-info-close" onClick={handleClose} aria-label="Close">×</button>
      <NeonSignPopup
        business={{ name: marker.title, category: signCategory }}
        mode={mode}
        rating={rating}
        verified={verified}
        websiteUrl={websiteUrl}
        menuUrl={menuUrl}
        bookUrl={bookUrl}
        onNavigate={handleNavigate}
        onChooseStay={handleChooseStay}
      />
    </div>
  );
}
