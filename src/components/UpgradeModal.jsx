import {
  FREE_BENEFITS,
  PREMIUM_BENEFITS,
  TIERS,
  TIER_PRICING,
  TRAVELER_BENEFITS,
  getTierPriceLabel,
  getUpgradeUrl,
} from "../lib/tiers.js";

export default function UpgradeModal({ onClose, onSignUp, creditStatus, reason = "trips" }) {
  const isGuest = creditStatus?.tier === "guest";
  const isGrocery = reason === "grocery";
  const badgeLabel = isGrocery ? "TripMappa Traveler" : "TripMappa Premium";

  const title = isGrocery
    ? "Grocery delivery is a Traveler feature"
    : isGuest
      ? "You've used your free Trip Generation"
      : "Monthly limit reached";

  const lead = isGrocery
    ? "Order groceries to your hotel with voice-to-list ordering and scheduled delivery before you arrive."
    : isGuest
      ? "Create a free account to get 3 Trip Generations every month — or upgrade for unlimited planning."
      : "You've used all 3 Trip Generations this month. Upgrade to Premium for unlimited trip planning.";

  const ctaHref = isGrocery
    ? getUpgradeUrl(TIERS.TRAVELER)
    : getUpgradeUrl(TIERS.PREMIUM);

  const ctaLabel = isGrocery
    ? `Upgrade to Traveler — ${getTierPriceLabel(TIERS.TRAVELER)}`
    : `Upgrade to Premium — ${getTierPriceLabel(TIERS.PREMIUM)}`;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal upgrade-modal" onClick={e => e.stopPropagation()} role="dialog" aria-labelledby="upgrade-title">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <div className="upgrade-modal-badge">{badgeLabel}</div>
        <h2 id="upgrade-title" className="upgrade-modal-title">{title}</h2>
        <p className="upgrade-modal-lead">{lead}</p>
        <ul className="upgrade-modal-benefits">
          <li><strong>Free</strong> — {FREE_BENEFITS[0]}</li>
          <li><strong>Premium ({TIER_PRICING[TIERS.PREMIUM].priceLabel})</strong> — {PREMIUM_BENEFITS[0]}</li>
          <li><strong>Traveler ({TIER_PRICING[TIERS.TRAVELER].priceLabel})</strong> — {TRAVELER_BENEFITS[1]}</li>
          <li><strong>Always free</strong> — Navigate Home, maps, and saved routes</li>
        </ul>
        <div className="upgrade-modal-actions">
          <a
            href={ctaHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-generate upgrade-modal-cta"
          >
            {ctaLabel}
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
