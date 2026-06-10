import { useState, useEffect, useMemo } from "react";
import BillingToggle from "./BillingToggle.jsx";
import {
  TRAILBLAZER_BENEFITS,
  VOYAGER_BENEFITS,
  TIERS,
  TIER_FEATURE_COMPARISON,
  formatTierPriceBlock,
  normalizeTier,
} from "../lib/tiers.js";
import { formatResetDate } from "../lib/creditsDisplay.js";
import { createCheckoutSession, createVoyagerCheckoutSession } from "../lib/stripeApi.js";

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
      ...formatTierPriceBlock(TIERS.VOYAGER, billingInterval),
    },
    {
      id: TIERS.TRAILBLAZER,
      label: "Trailblazer",
      benefits: TRAILBLAZER_BENEFITS,
      ...formatTierPriceBlock(TIERS.TRAILBLAZER, billingInterval),
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
      ? "Choose a plan to keep generating trips and premium features."
      : isGrocery
        ? "Grocery delivery to your hotel is included with Trailblazer."
        : isGuest
          ? "Create a free Wanderer account (3 trips total), or choose a paid plan below."
          : "You've used all 3 Wanderer generations. Upgrade to Voyager or Trailblazer to keep planning.";

  const monthlyLimitCta = tier === TIERS.VOYAGER
    ? "Upgrade to Trailblazer"
    : "Upgrade to Voyager or Trailblazer";

  const selected = upgradePlans.find(p => p.id === selectedPlan) || upgradePlans[1];
  const selectedPrice = formatTierPriceBlock(selectedPlan, billingInterval);

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

  const checkoutLabel = billingInterval === "year" && selectedPrice.billedAnnually
    ? `${selectedPrice.primary} billed annually`
    : selectedPrice.primary;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal upgrade-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-labelledby="upgrade-title"
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
              className="upgrade-plan-cards"
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
                      className="upgrade-plan-radio"
                    />
                    <div className="upgrade-plan-card-head">
                      <span className="upgrade-plan-card-name">{plan.label}</span>
                      <span className="upgrade-modal-price">{plan.primary}</span>
                      {plan.showSavings && (
                        <span className="billing-savings-badge">2 months free</span>
                      )}
                    </div>
                    {plan.billedAnnually && (
                      <span className="upgrade-plan-billed">
                        {plan.primary} billed annually
                        <span className="upgrade-plan-billed-total"> ({plan.billedAnnually}/yr)</span>
                      </span>
                    )}
                    <ul className="upgrade-modal-benefits upgrade-plan-benefits">
                      {plan.benefits.map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    {isDisabled && (
                      <p className="upgrade-plan-disabled-note">
                        Grocery delivery requires Trailblazer.
                      </p>
                    )}
                  </label>
                );
              })}
            </div>

            <details className="upgrade-compare-details">
              <summary>Compare all plan features</summary>
              <ul className="upgrade-compare-list">
                {TIER_FEATURE_COMPARISON.slice(0, 6).map(row => (
                  <li key={row.id}>
                    <strong>{row.label}:</strong>{" "}
                    Voyager {typeof row.voyager === "boolean" ? (row.voyager ? "✓" : "—") : row.voyager}
                    {" · "}
                    Trailblazer {typeof row.trailblazer === "boolean" ? (row.trailblazer ? "✓" : "—") : row.trailblazer}
                  </li>
                ))}
              </ul>
              {onOpenPricing && (
                <button type="button" className="upgrade-modal-secondary" onClick={onOpenPricing}>
                  View full pricing & Founder offer
                </button>
              )}
            </details>
          </>
        )}

        <div className="upgrade-modal-actions">
          {isMonthlyLimit ? (
            <button
              type="button"
              className="btn-generate upgrade-modal-cta pricing-cta pricing-cta--gold"
              onClick={handleMonthlyLimitPrimary}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? "Starting checkout…" : monthlyLimitCta}
            </button>
          ) : (
            <button
              type="button"
              className="btn-generate upgrade-modal-cta pricing-cta pricing-cta--gold"
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
              Sign up free — 3 Wanderer trips
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
