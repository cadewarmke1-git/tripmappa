import { useState } from "react";

export default function SosButton({ onConfirm, className = "" }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleConfirm() {
    setSending(true);
    try {
      await onConfirm?.();
      setOpen(false);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`live-sos-btn${className ? ` ${className}` : ""}`}
        onClick={() => setOpen(true)}
        aria-label="Emergency SOS"
        title="Emergency SOS"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2l7 4v6c0 5-3.5 9.5-7 10-3.5-.5-7-5-7-10V6l7-4z" stroke="currentColor" strokeWidth="1.6" fill="rgba(248,113,113,0.15)"/>
        </svg>
        SOS
      </button>
      {open && (
        <div className="live-sos-dialog-overlay" onClick={() => !sending && setOpen(false)} role="presentation">
          <div className="live-sos-dialog" onClick={e => e.stopPropagation()} role="dialog" aria-labelledby="sos-title">
            <h3 id="sos-title" className="live-sos-dialog-title">Send emergency alert?</h3>
            <p className="live-sos-dialog-text">Send your exact location to your emergency contact?</p>
            <div className="live-sos-dialog-actions">
              <button type="button" className="profile-btn profile-btn-ghost" onClick={() => setOpen(false)} disabled={sending}>
                Cancel
              </button>
              <button type="button" className="live-sos-confirm-btn" onClick={handleConfirm} disabled={sending}>
                {sending ? "Sending…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
