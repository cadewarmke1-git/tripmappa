import { useState, useEffect } from "react";
import {
  TRAILBLAZER_BENEFITS,
  VOYAGER_BENEFITS,
  TIERS,
  getTierPriceLabel,
} from "../lib/tiers.js";
import { createCheckoutSession, createVoyagerCheckoutSession } from "../lib/stripeApi.js";

const UPGRADE_PLANS = [
  {
    id: TIERS.VOYAGER,
    label: "Voyager",
    priceLabel: getTierPriceLabel(TIERS.VOYAGER),
    benefits: VOYAGER_BENEFITS,
  },
  {
    id: TIERS.TRAILBLAZER,
    label: "Trailblazer",
    priceLabel: getTierPriceLabel(TIERS.TRAILBLAZER),
    benefits: TRAILBLAZER_BENEFITS,
  },
];

export default function UpgradeModal({
  onClose,
  onSignUp,
  user,
  accessToken,
  creditStatus,
  reason = "trips",
  onCheckoutError,
}) {
  const isGrocery = reason === "grocery";
  const [selectedPlan, setSelectedPlan] = useState(TIERS.TRAILBLAZER);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  useEffect(() => {
    if (isGrocery) setSelectedPlan(TIERS.TRAILBLAZER);
  }, [isGrocery]);

  const isGuest = creditStatus?.tier === "guest";
  const isTrialEnded = reason === "trial-ended";

  const title = isTrialEnded
    ? "Your Trailblazer trial has ended"
    : isGrocery
      ? "Grocery delivery is a Trailblazer feature"
      : isGuest
        ? "You've used your free Trip Generation"
        : "Trip generations used";

  const lead = isTrialEnded
    ? "Choose a plan to keep unlimited trip generations and premium features."
    : isGrocery
      ? "Grocery delivery to your hotel is included with Trailblazer."
      : isGuest
        ? "Create a free account for 3 Trip Generations total, or choose a paid plan below."
        : "You've used all 3 Trip Generations. Choose Voyager or Trailblazer to keep planning.";

  const selected = UPGRADE_PLANS.find(p => p.id === selectedPlan) || UPGRADE_PLANS[1];

  async function handleCheckout() {
    if (!user?.id || !accessToken) {
      onSignUp?.();
      return;
    }
    setCheckoutError("");
    setCheckoutLoading(true);
    try {
      const payload = { userId: user.id, email: user.email || undefined };
      const startCheckout = selectedPlan === TIERS.VOYAGER
        ? createVoyagerCheckoutSession
        : createCheckoutSession;
      const { url } = await startCheckout(accessToken, payload);
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
      <div
        className="modal upgrade-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="upgrade-title"
        style={{ maxWidth: 480 }}
      >
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <div className="upgrade-modal-badge">Upgrade your plan</div>
        <h2 id="upgrade-title" className="upgrade-modal-title">{title}</h2>
        <p className="upgrade-modal-lead">{lead}</p>

        <div
          role="radiogroup"
          aria-label="Choose a subscription plan"
          style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}
        >
          {UPGRADE_PLANS.map(plan => {
            const isSelected = selectedPlan === plan.id;
            const isDisabled = isGrocery && plan.id === TIERS.VOYAGER;
            return (
              <label
                key={plan.id}
                className={`upgrade-plan-card${isSelected ? " is-selected" : ""}${isDisabled ? " is-disabled" : ""}`}
              >
                <input
                  type="radio"
                  name="upgrade-plan"
                  value={plan.id}
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => {
                    if (!isDisabled) setSelectedPlan(plan.id);
                  }}
                  style={{ marginRight: 8 }}
                />
                <span style={{ fontWeight: 700, marginRight: 8 }}>{plan.label}</span>
                <span className="upgrade-modal-price" style={{ display: "inline", margin: 0 }}>
                  {plan.priceLabel}
                </span>
                <ul className="upgrade-modal-benefits upgrade-plan-benefits">
                  {plan.benefits.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {isDisabled && (
                  <p className="upgrade-modal-lead" style={{ margin: "8px 0 0", fontSize: 12 }}>
                    Grocery delivery requires Trailblazer.
                  </p>
                )}
              </label>
            );
          })}
        </div>

        <div className="upgrade-modal-actions">
          <button
            type="button"
            className="btn-generate upgrade-modal-cta"
            onClick={handleCheckout}
            disabled={checkoutLoading}
          >
            {checkoutLoading
              ? "Starting checkout…"
              : `Subscribe to ${selected.label} — ${selected.priceLabel}`}
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
