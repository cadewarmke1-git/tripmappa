import { Marker } from "@react-google-maps/api";
import { buildMarkerIcon } from "../../lib/mapMarkers.js";

export default function MapMarkerLayer({ markers = [], isDarkMode, onMarkerClick, dismissedAlertIds = [] }) {
  const visible = markers.filter(m => !m.alertId || !dismissedAlertIds.includes(m.alertId));

  return visible.map(m => (
    <Marker
      key={m.id}
      position={{ lat: m.lat, lng: m.lng }}
      icon={buildMarkerIcon(m.category, isDarkMode, { pinNumber: m.pinNumber, pinSize: m.pinSize })}
      title={m.title}
      onClick={(event) => {
        // Prevent the map's onClick from clearing the selected marker in the same tick.
        event?.stop?.();
        onMarkerClick?.(m);
      }}
      zIndex={m.zIndex}
    />
  ));
}
