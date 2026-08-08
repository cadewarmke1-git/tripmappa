/**
 * Blocks Navigate Only Google car routing when a truck vehicle is selected.
 * Steers the user into the full planning flow for HERE truck-safe routing.
 */
import { useTheme } from "../../context/ThemeContext.jsx";
import { useDialogA11y } from "../../hooks/useDialogA11y.js";

export default function TruckNavigateOnlyGate({
  open = false,
  onPlanTrip,
  onCancel,
  vehicleLabel = "your truck",
}) {
  const { theme } = useTheme();
  const dialogRef = useDialogA11y(open, onCancel, "truck-navigate-gate-title");
  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className={`modal-overlay confirm-dialog-overlay tm-theme-${theme}`}
      role="alertdialog"
      aria-labelledby="truck-navigate-gate-title"
      aria-describedby="truck-navigate-gate-message"
      data-testid="truck-navigate-gate"
      onClick={onCancel}
    >
      <div
        className="modal confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <h2 id="truck-navigate-gate-title" className="confirm-dialog-title">
          Truck routing needs a full plan
        </h2>
        <p id="truck-navigate-gate-message" className="confirm-dialog-message">
          Navigate Only uses a standard car driving route. That is not safe for{" "}
          {vehicleLabel} — it ignores height, weight, and hazmat limits.
          Plan a full trip in TripMappa to get truck-safe routing before you drive.
        </p>
        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="confirm-dialog-cancel"
            data-testid="truck-navigate-gate-cancel"
            onClick={onCancel}
          >
            Stay here
          </button>
          <button
            type="button"
            className="confirm-dialog-confirm"
            data-testid="truck-navigate-gate-plan"
            onClick={onPlanTrip}
          >
            Plan a truck trip
          </button>
        </div>
      </div>
    </dialog>
  );
}
