import { OverlayView } from "@react-google-maps/api";

export default function ConvoyPin({
  latitude,
  longitude,
  color,
  label,
  isOwner = false,
}) {
  if (latitude == null || longitude == null) return null;

  return (
    <OverlayView
      position={{ lat: latitude, lng: longitude }}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <div className={`convoy-pin-wrap${isOwner ? " convoy-pin-owner" : ""}`}>
        <div
          className="convoy-pin-dot"
          style={{ background: color, boxShadow: isOwner ? "0 0 0 3px rgba(255,210,140,0.85)" : undefined }}
        />
        {label && <div className="convoy-pin-label">{label}</div>}
      </div>
    </OverlayView>
  );
}
