import { useState } from "react";
import { useDialogA11y } from "../../hooks/useDialogA11y.js";

/** Emergency SOS — hidden until Twilio SMS alerts are live. */
export const SOS_UI_ENABLED = false;

export default function SosButton({ onConfirm, className = "", comingSoon = false }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const dialogRef = useDialogA11y(open && !comingSoon, () => !sending && setOpen(false), "sos-title");

  if (!SOS_UI_ENABLED || comingSoon) return null;

  async function handleConfirm() {
    setSending(true);
    try {
      await onConfirm?.();
      setOpen(false);
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    if (!sending) setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className={`live-sos-btn${comingSoon ? " live-sos-btn-disabled" : ""}${className ? ` ${className}` : ""}`}
        onClick={() => !comingSoon && setOpen(true)}
        disabled={comingSoon}
        aria-label={comingSoon ? "Emergency SMS coming soon" : "Emergency SOS"}
        title={comingSoon ? "Emergency SMS requires Twilio setup (coming soon)" : "Emergency SOS"}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2l7 4v6c0 5-3.5 9.5-7 10-3.5-.5-7-5-7-10V6l7-4z" stroke="currentColor" strokeWidth="1.6" fill="rgba(248,113,113,0.15)"/>
        </svg>
        {comingSoon ? "SOS (soon)" : "SOS"}
      </button>
      {open && !comingSoon && (
        <dialog
          ref={dialogRef}
          className="live-sos-dialog-overlay"
          aria-labelledby="sos-title"
          onClick={handleClose}
        >
          <div className="live-sos-dialog" onClick={e => e.stopPropagation()}>
            <h3 id="sos-title" className="live-sos-dialog-title">Send emergency alert?</h3>
            <p className="live-sos-dialog-text">Send your exact location to your emergency contact?</p>
            <div className="live-sos-dialog-actions">
              <button type="button" className="profile-btn profile-btn-ghost" onClick={handleClose} disabled={sending}>
                Cancel
              </button>
              <button type="button" className="live-sos-confirm-btn" onClick={handleConfirm} disabled={sending}>
                {sending ? "Sending…" : "Confirm"}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
