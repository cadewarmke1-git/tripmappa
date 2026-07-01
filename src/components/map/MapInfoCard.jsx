import { useCallback, useEffect, useState } from "react";
import { useDialogA11y } from "../../hooks/useDialogA11y.js";
import VintageNeonSignCard from "../signs/VintageNeonSignCard.jsx";
import { markerToSignCategory, signCategoryLabel } from "../../lib/neonSignCategory.js";

function resolveWebsiteUrl(marker) {
  return marker?.website || marker?.websiteUri || marker?.bookUrl || null;
}

function resolveMenuUrl(marker) {
  return marker?.menuUrl || marker?.menu || null;
}

function isRestaurantMarker(marker, signCategory) {
  if (signCategory === "food") return true;
  const cat = String(marker?.category || "").toLowerCase();
  return cat === "restaurant" || cat === "food";
}

export default function MapInfoCard({ marker, theme = "night", onClose, onAction }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, [marker?.id]);

  // Stable close handler so focus trap / Escape listener are not re-bound every render (a11y harden).
  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(() => onClose?.(), 200);
  }, [onClose]);

  // Wire aria-modal, Escape-to-close, initial focus, and Tab trap for the map pin popup (a11y harden).
  const dialogRef = useDialogA11y(Boolean(marker), handleClose, "map-info-card-title");

  if (!marker) return null;

  const signCategory = markerToSignCategory(marker.category);
  const categoryLabel = signCategoryLabel(signCategory, "Stop");
  const websiteUrl = resolveWebsiteUrl(marker);
  const menuUrl = resolveMenuUrl(marker);
  const showMenu = isRestaurantMarker(marker, signCategory) && Boolean(menuUrl);

  return (
    <div
      ref={dialogRef}
      className={`map-info-card map-info-card-drawer map-info-card--popup map-info-card--${signCategory} ${theme}${visible ? " is-open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-info-card-title"
    >
      {/* Screen-reader dialog title; visible sign name stays in VintageNeonSignCard for sighted users. */}
      <h2 id="map-info-card-title" className="map-info-card-sr-title">{marker.title}</h2>
      <button type="button" className="map-info-close" onClick={handleClose} aria-label="Close">×</button>
      <VintageNeonSignCard
        variant="popup"
        signCategory={signCategory}
        businessName={marker.title}
        categoryLabel={categoryLabel}
        className="map-info-vneon"
      />
      <div className="map-info-action-row" role="group" aria-label="Place actions">
        <button
          type="button"
          className="map-info-action-btn"
          onClick={() => onAction?.("directions", marker)}
        >
          Directions
        </button>
        {websiteUrl && (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="map-info-action-btn map-info-action-link"
          >
            Website
          </a>
        )}
        {showMenu && (
          <a
            href={menuUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="map-info-action-btn map-info-action-link"
          >
            Menu
          </a>
        )}
      </div>
    </div>
  );
}
