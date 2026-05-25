import { MARKER_CATEGORIES } from "../../lib/mapMarkers.js";

export default function MapInfoCard({ marker, onClose, onAction }) {
  if (!marker) return null;
  const cat = MARKER_CATEGORIES[marker.category]?.label || "Stop";

  return (
    <div className="map-info-card" role="dialog" aria-label={marker.title}>
      <button type="button" className="map-info-close" onClick={onClose} aria-label="Close">×</button>
      <div className="map-info-category">{cat}</div>
      <div className="map-info-title">{marker.title}</div>
      {marker.subtitle && <div className="map-info-sub">{marker.subtitle}</div>}
      {marker.distanceMiles != null && (
        <div className="map-info-distance">{marker.distanceMiles} mi from route</div>
      )}
      <div className="map-info-actions">
        {marker.action === "book" && marker.bookUrl && (
          <a href={marker.bookUrl} target="_blank" rel="noopener noreferrer" className="map-info-btn primary">Book Now</a>
        )}
        {marker.action === "add" && (
          <button type="button" className="map-info-btn primary" onClick={() => onAction?.("add", marker)}>Add to Trip</button>
        )}
        {(marker.action === "directions" || !marker.action) && (
          <button type="button" className="map-info-btn" onClick={() => onAction?.("directions", marker)}>Get Directions</button>
        )}
      </div>
    </div>
  );
}
