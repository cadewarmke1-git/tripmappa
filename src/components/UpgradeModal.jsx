import { useState } from "react";
import {
  TRAILBLAZER_BENEFITS,
  TIERS,
  getTierPriceLabel,
} from "../lib/tiers.js";
import { createCheckoutSession } from "../lib/stripeApi.js";

export default function UpgradeModal({
  onClose,
  onSignUp,
  user,
  accessToken,
  creditStatus,
  reason = "trips",
  onCheckoutError,
}) {
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  const isGuest = creditStatus?.tier === "guest";
  const isGrocery = reason === "grocery";
  const isTrialEnded = reason === "trial-ended";

  const title = isTrialEnded
    ? "Your Trailblazer trial has ended"
    : isGrocery
      ? "Grocery delivery is a Trailblazer feature"
      : isGuest
        ? "You've used your free Trip Generation"
        : "Trip generations used";

  const lead = isTrialEnded
    ? "Subscribe to Trailblazer to keep unlimited trip generations, grocery delivery, and priority planning."
    : isGrocery
      ? "Order groceries to your hotel with voice-to-list ordering and scheduled delivery before you arrive."
      : isGuest
        ? "Create a free account for 3 Trip Generations total, or upgrade for unlimited planning and grocery delivery."
        : "You've used all 3 Trip Generations. Upgrade to Trailblazer for unlimited trip planning and grocery delivery.";

  const priceLabel = getTierPriceLabel(TIERS.TRAILBLAZER);

  async function handleCheckout() {
    if (!user?.id || !accessToken) {
      onSignUp?.();
      return;
    }
    setCheckoutError("");
    setCheckoutLoading(true);
    try {
      const { url } = await createCheckoutSession(accessToken, {
        userId: user.id,
        email: user.email || undefined,
      });
      if (url) {
        window.location.href = url;
        return;
      }
      throw new Error("Could not start checkout");
    } catch (err) {
      const message = err.message || "Could not start checkout";
      setCheckoutError(message);
      onCheckoutError?.(message);
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal upgrade-modal" onClick={e => e.stopPropagation()} role="dialog" aria-labelledby="upgrade-title">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <div className="upgrade-modal-badge">TripMappa Trailblazer</div>
        <h2 id="upgrade-title" className="upgrade-modal-title">{title}</h2>
        <p className="upgrade-modal-lead">{lead}</p>
        <p className="upgrade-modal-price">{priceLabel}</p>
        <ul className="upgrade-modal-benefits">
          {TRAILBLAZER_BENEFITS.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="upgrade-modal-actions">
          <button
            type="button"
            className="btn-generate upgrade-modal-cta"
            onClick={handleCheckout}
            disabled={checkoutLoading}
          >
            {checkoutLoading ? "Starting checkout…" : `Subscribe — ${priceLabel}`}
          </button>
          {checkoutError && (
            <p className="upgrade-modal-error" role="alert">{checkoutError}</p>
          )}
          {isGuest && onSignUp && (
            <button type="button" className="upgrade-modal-secondary" onClick={onSignUp}>
              Sign up free for 3 Trip Generations
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
