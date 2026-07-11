import { useTheme } from "../context/ThemeContext.jsx";
import { useDialogA11y } from "../hooks/useDialogA11y.js";

/** Lightweight confirm modal for destructive or irreversible actions. */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}) {
  const { theme } = useTheme();
  const dialogRef = useDialogA11y(open, onCancel, "confirm-dialog-title");
  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className={`modal-overlay confirm-dialog-overlay tm-theme-${theme}`}
      role="alertdialog"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      onClick={onCancel}
    >
      <div
        className="modal confirm-dialog"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-message" className="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          <button type="button" className="confirm-dialog-cancel" onClick={onCancel}>{cancelLabel}</button>
          <button
            type="button"
            className={`confirm-dialog-confirm${danger ? " confirm-dialog-confirm-danger" : ""}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
