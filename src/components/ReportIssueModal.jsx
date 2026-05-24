export default function ReportIssueModal({ reportText, onTextChange, onClose, onSubmit }) {
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-title">Report an issue</div>
        <div className="modal-sub">Tell us what went wrong and we&apos;ll look into it.</div>
        <textarea
          className="report-textarea"
          placeholder="Describe the issue…"
          value={reportText}
          onChange={e => onTextChange(e.target.value)}
        />
        <div className="modal-footer">
          <button type="button" className="modal-btn modal-btn-outline" onClick={onClose}>Cancel</button>
          <button type="button" className="modal-btn modal-btn-primary" onClick={onSubmit}>Submit</button>
        </div>
      </div>
    </div>
  );
}
