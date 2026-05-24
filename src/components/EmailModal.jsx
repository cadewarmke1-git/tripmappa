export default function EmailModal({ email, onEmailChange, onClose, onContinue, onContinueWithEnter }) {
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-title">Continue with email</div>
        <div className="modal-sub">Enter your email to create your TripMappa account.</div>
        <input
          type="email"
          className="grocery-input"
          placeholder="you@example.com"
          value={email}
          onChange={e => onEmailChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onContinueWithEnter()}
          style={{ width: "100%", marginBottom: 14, padding: "12px 14px", borderRadius: 10 }}
        />
        <div className="modal-footer">
          <button type="button" className="modal-btn modal-btn-outline" onClick={onClose}>Cancel</button>
          <button type="button" className="modal-btn modal-btn-primary" onClick={onContinue}>Continue</button>
        </div>
      </div>
    </div>
  );
}
