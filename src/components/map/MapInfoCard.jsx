import { useEffect, useState } from "react";
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

  if (!marker) return null;

  const signCategory = markerToSignCategory(marker.category);
  const categoryLabel = signCategoryLabel(signCategory, "Stop");
  const websiteUrl = resolveWebsiteUrl(marker);
  const menuUrl = resolveMenuUrl(marker);
  const showMenu = isRestaurantMarker(marker, signCategory) && Boolean(menuUrl);

  function handleClose() {
    setVisible(false);
    setTimeout(() => onClose?.(), 200);
  }

  return (
    <div
      className={`map-info-card map-info-card-drawer map-info-card--popup ${theme}${visible ? " is-open" : ""}`}
      role="dialog"
      aria-label={marker.title}
    >
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
