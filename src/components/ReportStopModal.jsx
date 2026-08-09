import { useState } from "react";
import { useDialogA11y } from "../hooks/useDialogA11y.js";
import { STOP_REPORT_REASONS, submitStopReport } from "../lib/stopReportApi.js";
import ModalCloseButton from "./ModalCloseButton.jsx";

function formatCoords(lat, lng) {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return `${a.toFixed(5)}, ${b.toFixed(5)}`;
}

export default function ReportStopModal({
  target,
  tripId = null,
  accessToken = null,
  onClose,
  onSubmitted,
}) {
  const dialogRef = useDialogA11y(Boolean(target), onClose, "report-stop-title");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!target) return null;

  const coords = formatCoords(target.lat, target.lng);
  const canSubmit = Boolean(reason) && !submitting;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitStopReport({
        accessToken,
        tripId,
        target,
        reason,
        details,
      });
      onSubmitted?.(result);
      onClose?.();
    } catch (err) {
      setError(err?.message || "Could not save report");
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal-overlay"
      aria-labelledby="report-stop-title"
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <form className="modal report-stop-modal" onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
        <ModalCloseButton onClose={onClose} />
        <div className="modal-title" id="report-stop-title">Report this stop</div>
        <div className="modal-sub">
          Flag a problem with this suggestion. We review these when tuning trip results.
        </div>

        <div className="report-stop-context" aria-label="Stop details">
          <div className="report-stop-context-name">{target.stopName}</div>
          <div className="report-stop-context-meta">
            <span>{target.category || target.sourceKind}</span>
            {coords ? (
              <>
                <span className="report-stop-context-sep" aria-hidden>·</span>
                <span>{coords}</span>
              </>
            ) : null}
          </div>
        </div>

        <fieldset className="report-stop-reasons">
          <legend className="report-stop-legend">What&apos;s wrong?</legend>
          {STOP_REPORT_REASONS.map(option => (
            <label key={option.value} className="report-stop-reason">
              <input
                type="radio"
                name="stop-report-reason"
                value={option.value}
                checked={reason === option.value}
                onChange={() => setReason(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>

        <label className="report-stop-details-label" htmlFor="report-stop-details">
          Anything else? <span className="report-stop-optional">(optional)</span>
        </label>
        <textarea
          id="report-stop-details"
          className="report-textarea report-stop-details"
          placeholder="A short note helps — hours, wrong pin, outdated info…"
          value={details}
          maxLength={1000}
          onChange={e => setDetails(e.target.value)}
        />

        {error ? <p className="report-stop-error" role="alert">{error}</p> : null}

        <div className="modal-footer">
          <button type="button" className="modal-btn modal-btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="modal-btn modal-btn-primary" disabled={!canSubmit}>
            {submitting ? "Sending…" : "Submit report"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
