export default function OAuthComingSoonModal({ provider, onClose, onUseEmail }) {
  const label = provider === "google" ? "Google" : provider === "facebook" ? "Facebook" : "Apple";

  return (
    <div className="modal-overlay auth-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="auth-modal auth-modal-compact">
        <div className="auth-modal-gold-border" aria-hidden="true"/>
        <div className="auth-modal-logo">Trip<span>Mappa</span></div>
        <h2 className="auth-modal-headline">{label} sign in coming soon — use email for now</h2>
        <p className="auth-modal-sub">Full {label} OAuth via Supabase Auth is on the way.</p>
        <button type="button" className="btn-generate auth-modal-submit" onClick={onUseEmail}>Continue with email</button>
        <button type="button" className="auth-modal-link-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
