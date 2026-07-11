import { useDialogA11y } from "../hooks/useDialogA11y.js";

export default function LocationPermissionModal({
  open,
  onAllow,
  onDeny,
  denied = false,
}) {
  const dialogRef = useDialogA11y(open, onDeny, "location-permission-title");
  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="modal-overlay location-permission-overlay"
      aria-labelledby="location-permission-title"
      onClick={onDeny}
    >
      <div
        className="modal location-permission-modal"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="location-permission-title" className="location-permission-title">
          {denied ? "Location access is off" : "Share your live location?"}
        </h2>
        <p className="location-permission-body">
          {denied
            ? "TripMappa needs location permission to show your position on the map for friends and family following your trip. Enable location in your browser settings, then try again."
            : "TripMappa uses your device location only while live sharing is active so people you invite can see where you are on the route. We do not track you when sharing is off."}
        </p>
        <div className="location-permission-actions">
          {!denied && (
            <button type="button" className="btn-generate" onClick={onAllow}>
              Allow location access
            </button>
          )}
          <button type="button" className="location-permission-secondary" onClick={onDeny}>
            {denied ? "Close" : "Not now"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
