export default function UpgradeModal({ onClose, onSignUp, creditStatus }) {
  const isGuest = creditStatus?.tier === "guest";

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal upgrade-modal" onClick={e => e.stopPropagation()} role="dialog" aria-labelledby="upgrade-title">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <div className="upgrade-modal-badge">TripMappa Premium</div>
        <h2 id="upgrade-title" className="upgrade-modal-title">
          {isGuest ? "You've used your free Trip Generation" : "Monthly limit reached"}
        </h2>
        <p className="upgrade-modal-lead">
          {isGuest
            ? "Create a free account to get 3 Trip Generations every month — or upgrade for unlimited planning."
            : "You've used all 3 Trip Generations this month. Upgrade to Premium for unlimited trip planning."}
        </p>
        <ul className="upgrade-modal-benefits">
          <li><strong>Free</strong> — 3 Trip Generations per month</li>
          <li><strong>Premium ($7.99/mo)</strong> — Unlimited Trip Generations</li>
          <li><strong>Always free</strong> — Navigate Home, maps, and saved routes</li>
        </ul>
        <div className="upgrade-modal-actions">
          <a
            href="https://tripmappa.com/upgrade"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-generate upgrade-modal-cta"
          >
            Upgrade to Premium — $7.99/mo
          </a>
          {isGuest && onSignUp && (
            <button type="button" className="upgrade-modal-secondary" onClick={onSignUp}>
              Sign up free for 3 Trip Generations/month
            </button>
          )}
          <button type="button" className="upgrade-modal-dismiss" onClick={onClose}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
