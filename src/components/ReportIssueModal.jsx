import { useState } from "react";
import { useDialogA11y } from "../hooks/useDialogA11y.js";
import { reportClientError } from "../lib/clientErrorReport.js";
import ModalCloseButton from "./ModalCloseButton.jsx";

export default function ReportIssueModal({ reportText, onTextChange, onClose, onSubmit }) {
  const dialogRef = useDialogA11y(true, onClose, "report-issue-title");
  const [submitting, setSubmitting] = useState(false);
  const trimmed = reportText.trim();

  async function handleSubmit() {
    if (!trimmed || submitting) return;
    setSubmitting(true);
    reportClientError({
      label: "user-report",
      message: trimmed,
      url: window.location.href,
    });
    await onSubmit?.(trimmed);
    setSubmitting(false);
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal-overlay"
      aria-labelledby="report-issue-title"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" onClick={e => e.stopPropagation()}>
        <ModalCloseButton onClose={onClose} />
        <div className="modal-title" id="report-issue-title">Report an issue</div>
        <div className="modal-sub">Tell us what went wrong and we&apos;ll look into it.</div>
        <textarea
          className="report-textarea"
          placeholder="Describe the issue…"
          value={reportText}
          onChange={e => onTextChange(e.target.value)}
          aria-label="Issue description"
        />
        <div className="modal-footer">
          <button type="button" className="modal-btn modal-btn-outline" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="modal-btn modal-btn-primary"
            onClick={handleSubmit}
            disabled={!trimmed || submitting}
          >
            {submitting ? "Sending…" : "Submit"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
