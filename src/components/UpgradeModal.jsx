import { useState, useEffect, useMemo } from "react";
import {
  TRAILBLAZER_BENEFITS,
  VOYAGER_BENEFITS,
  TIERS,
  getTierAnnualMonthlyEquivalent,
  getTierPriceLabel,
  normalizeTier,
} from "../lib/tiers.js";
import { formatResetDate } from "../lib/creditsDisplay.js";
import { createCheckoutSession, createVoyagerCheckoutSession } from "../lib/stripeApi.js";

function BillingToggle({ value, onChange }) {
  return (
    <div className="billing-toggle" role="group" aria-label="Billing period">
      <button
        type="button"
        className={`billing-toggle-btn${value === "month" ? " is-active" : ""}`}
        onClick={() => onChange("month")}
      >
        Monthly
      </button>
      <button
        type="button"
        className={`billing-toggle-btn${value === "year" ? " is-active" : ""}`}
        onClick={() => onChange("year")}
      >
        Annual
      </button>
    </div>
  );
}

function planPriceDisplay(tier, billingInterval) {
  if (billingInterval === "year") {
    const monthlyEq = getTierAnnualMonthlyEquivalent(tier);
    return {
      primary: monthlyEq ? `$${monthlyEq}/mo` : getTierPriceLabel(tier, "year"),
      secondary: getTierPriceLabel(tier, "year"),
      showSavings: true,
    };
  }
  return {
    primary: getTierPriceLabel(tier),
    secondary: null,
    showSavings: false,
  };
}

export default function UpgradeModal({
  onClose,
  onSignUp,
  onOpenPricing,
  user,
  accessToken,
  creditStatus,
  reason = "trips",
  resetDate = null,
  initialPlan = TIERS.TRAILBLAZER,
  initialBillingInterval = "month",
  onCheckoutError,
}) {
  const isGrocery = reason === "grocery";
  const isMonthlyLimit = reason === "monthly-limit";
  const [selectedPlan, setSelectedPlan] = useState(initialPlan);
  const [billingInterval, setBillingInterval] = useState(initialBillingInterval);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  useEffect(() => {
    if (isGrocery) setSelectedPlan(TIERS.TRAILBLAZER);
  }, [isGrocery]);

  useEffect(() => {
    setSelectedPlan(initialPlan);
  }, [initialPlan]);

  useEffect(() => {
    setBillingInterval(initialBillingInterval);
  }, [initialBillingInterval]);

  const upgradePlans = useMemo(() => [
    {
      id: TIERS.VOYAGER,
      label: "Voyager",
      benefits: VOYAGER_BENEFITS,
      ...planPriceDisplay(TIERS.VOYAGER, billingInterval),
    },
    {
      id: TIERS.TRAILBLAZER,
      label: "Trailblazer",
      benefits: TRAILBLAZER_BENEFITS,
      ...planPriceDisplay(TIERS.TRAILBLAZER, billingInterval),
    },
  ], [billingInterval]);

  const isGuest = creditStatus?.tier === "guest";
  const isTrialEnded = reason === "trial-ended";
  const tier = normalizeTier(creditStatus?.tier);
  const effectiveResetDate = resetDate || creditStatus?.resetDate;

  const title = isMonthlyLimit
    ? "You have used all your Trip Generations this month"
    : isTrialEnded
      ? "Your Trailblazer trial has ended"
      : isGrocery
        ? "Grocery delivery is a Trailblazer feature"
        : isGuest
          ? "You've used your free Trip Generation"
          : "Trip generations used";

  const lead = isMonthlyLimit
    ? `Your generation limit resets on ${formatResetDate(effectiveResetDate)}. Upgrade for more generations before then.`
    : isTrialEnded
      ? "Choose a plan to keep unlimited trip generations and premium features."
      : isGrocery
        ? "Grocery delivery to your hotel is included with Trailblazer."
        : isGuest
          ? "Create a free account for 3 Trip Generations total, or choose a paid plan below."
          : "You've used all 3 Trip Generations. Choose Voyager or Trailblazer to keep planning.";

  const monthlyLimitCta = tier === TIERS.VOYAGER
    ? "Upgrade to Trailblazer"
    : "Upgrade to Voyager or Trailblazer";

  const selected = upgradePlans.find(p => p.id === selectedPlan) || upgradePlans[1];

  async function handleCheckout() {
    if (!user?.id || !accessToken) {
      onSignUp?.();
      return;
    }
    setCheckoutError("");
    setCheckoutLoading(true);
    try {
      const payload = { userId: user.id, email: user.email || undefined, billingInterval };
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

  function handleMonthlyLimitPrimary() {
    if (onOpenPricing) {
      onOpenPricing();
      return;
    }
    if (tier === TIERS.VOYAGER) {
      setSelectedPlan(TIERS.TRAILBLAZER);
      void handleCheckout();
      return;
    }
    void handleCheckout();
  }

  const checkoutLabel = billingInterval === "year"
    ? `${selected.primary} (${selected.secondary})`
    : selected.primary;

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
        {!isMonthlyLimit && <div className="upgrade-modal-badge">Upgrade your plan</div>}
        <h2 id="upgrade-title" className="upgrade-modal-title">{title}</h2>
        <p className="upgrade-modal-lead">{lead}</p>

        {!isMonthlyLimit && (
          <>
            <BillingToggle value={billingInterval} onChange={setBillingInterval} />
            <div
              role="radiogroup"
              aria-label="Choose a subscription plan"
              style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}
            >
              {upgradePlans.map(plan => {
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
                      {plan.primary}
                    </span>
                    {plan.showSavings && (
                      <span className="billing-savings-badge">2 months free</span>
                    )}
                    {plan.secondary && (
                      <span className="upgrade-plan-billed">{plan.secondary} billed annually</span>
                    )}
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
          </>
        )}

        <div className="upgrade-modal-actions">
          {isMonthlyLimit ? (
            <button
              type="button"
              className="btn-generate upgrade-modal-cta"
              onClick={handleMonthlyLimitPrimary}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? "Starting checkout…" : monthlyLimitCta}
            </button>
          ) : (
            <button
              type="button"
              className="btn-generate upgrade-modal-cta"
              onClick={handleCheckout}
              disabled={checkoutLoading}
            >
              {checkoutLoading
                ? "Starting checkout…"
                : `Subscribe to ${selected.label} — ${checkoutLabel}`}
            </button>
          )}
          {checkoutError && (
            <p className="upgrade-modal-error" role="alert">{checkoutError}</p>
          )}
          {isGuest && onSignUp && !isMonthlyLimit && (
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
