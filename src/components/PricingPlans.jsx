import BillingToggle from "./BillingToggle.jsx";
import FoundingSlotsCounter from "./FoundingSlotsCounter.jsx";
import {
  TIERS,
  TIER_FEATURE_COMPARISON,
  WANDERER_BENEFITS,
  VOYAGER_BENEFITS,
  TRAILBLAZER_BENEFITS,
  FOUNDER_BENEFITS,
  formatTierPriceBlock,
  getTierLabel,
  normalizeTier,
  isFounderTier,
} from "../lib/tiers.js";

function FeatureCell({ value }) {
  if (value === true) {
    return <span className="pricing-compare-yes" aria-label="Included">✓</span>;
  }
  if (value === false) {
    return <span className="pricing-compare-no" aria-label="Not included">—</span>;
  }
  return <span className="pricing-compare-text">{value}</span>;
}

function TierPrice({ tier, billingInterval }) {
  const block = formatTierPriceBlock(tier, billingInterval);
  return (
    <div className="pricing-tier-price">
      <span className="pricing-tier-price-primary">{block.primary}</span>
      {block.showSavings && (
        <span className="billing-savings-badge billing-savings-badge--inline">2 months free</span>
      )}
      {block.billedAnnually && (
        <>
          <span className="pricing-tier-price-billed">{block.primary} billed annually</span>
          <span className="pricing-tier-price-sub">{block.billedAnnually} total per year</span>
        </>
      )}
      {block.secondary && !block.billedAnnually && block.secondary !== block.primary && (
        <span className="pricing-tier-price-sub">{block.secondary}</span>
      )}
    </div>
  );
}

export default function PricingPlans({
  billingInterval = "month",
  onBillingChange,
  currentTier = null,
  showBillingToggle = true,
  showComparison = true,
  showFounder = true,
  showWanderer = true,
  compact = false,
  onGetStarted,
  onUpgradeVoyager,
  onUpgradeTrailblazer,
  onSignIn,
}) {
  const normalizedCurrent = currentTier ? normalizeTier(currentTier) : null;
  const isCurrentFounder = isFounderTier(currentTier);

  const paidTiers = [
    {
      id: TIERS.VOYAGER,
      label: getTierLabel(TIERS.VOYAGER),
      benefits: VOYAGER_BENEFITS,
      cta: "Start Voyager",
      onCta: onUpgradeVoyager,
      highlight: false,
    },
    {
      id: TIERS.TRAILBLAZER,
      label: getTierLabel(TIERS.TRAILBLAZER),
      benefits: TRAILBLAZER_BENEFITS,
      cta: "Go Trailblazer",
      onCta: onUpgradeTrailblazer,
      highlight: true,
    },
  ];

  function isCurrentTier(tierId) {
    if (isCurrentFounder && tierId === TIERS.TRAILBLAZER) return false;
    return normalizedCurrent === tierId;
  }

  return (
    <div className={`pricing-plans${compact ? " pricing-plans--compact" : ""}`}>
      {showBillingToggle && onBillingChange && (
        <div className="pricing-billing-row">
          <BillingToggle value={billingInterval} onChange={onBillingChange} />
          <p className="pricing-billing-hint">
            Annual billing saves 2 months — shown as the monthly equivalent below.
          </p>
        </div>
      )}

      <div className={`pricing-tier-grid${showWanderer ? "" : " pricing-tier-grid--paid-only"}`}>
        {showWanderer && (
          <article className={`pricing-tier-card pricing-tier-card--wanderer${isCurrentTier(TIERS.WANDERER) ? " is-current" : ""}`}>
            <h3 className="pricing-tier-name">Wanderer</h3>
            <TierPrice tier={TIERS.WANDERER} billingInterval={billingInterval} />
            <ul className="pricing-tier-benefits">
              {WANDERER_BENEFITS.map(item => <li key={item}>{item}</li>)}
            </ul>
            {isCurrentTier(TIERS.WANDERER) ? (
              <span className="pricing-tier-current-pill">Your current plan</span>
            ) : (
              <button type="button" className="pricing-cta pricing-cta--secondary" onClick={onGetStarted || onSignIn}>
                Get started free
              </button>
            )}
          </article>
        )}

        {paidTiers.map(tier => (
          <article
            key={tier.id}
            className={`pricing-tier-card pricing-tier-card--${tier.id}${tier.highlight ? " is-featured" : ""}${isCurrentTier(tier.id) ? " is-current" : ""}`}
          >
            {tier.highlight && <span className="pricing-tier-featured-badge">Most popular</span>}
            <h3 className={`pricing-tier-name pricing-tier-name--${tier.id}`}>{tier.label}</h3>
            <TierPrice tier={tier.id} billingInterval={billingInterval} />
            <ul className="pricing-tier-benefits">
              {tier.benefits.map(item => <li key={item}>{item}</li>)}
            </ul>
            {isCurrentTier(tier.id) ? (
              <span className="pricing-tier-current-pill">Your current plan</span>
            ) : (
              <button
                type="button"
                className="pricing-cta pricing-cta--gold"
                onClick={() => tier.onCta?.({ billingPeriod: billingInterval })}
              >
                {tier.cta}
                {billingInterval === "year" && (
                  <> — {formatTierPriceBlock(tier.id, billingInterval).primary}</>
                )}
                {billingInterval === "month" && (
                  <> — {formatTierPriceBlock(tier.id, "month").primary}</>
                )}
              </button>
            )}
          </article>
        ))}

        {showFounder && (
          <article className={`pricing-tier-card pricing-tier-card--founder${isCurrentFounder ? " is-current" : ""}`}>
            <h3 className="pricing-tier-name pricing-tier-name--founder">Founder</h3>
            <TierPrice tier={TIERS.FOUNDER} billingInterval={billingInterval} />
            <FoundingSlotsCounter variant="pricing" />
            <ul className="pricing-tier-benefits">
              {FOUNDER_BENEFITS.map(item => <li key={item}>{item}</li>)}
            </ul>
            {isCurrentFounder ? (
              <span className="pricing-tier-current-pill">You&apos;re a Founder</span>
            ) : (
              <p className="pricing-founder-cta-note">
                Sign up while spots remain — Founder status is applied automatically at registration.
              </p>
            )}
          </article>
        )}
      </div>

      {showComparison && (
        <div className="pricing-compare-wrap">
          <h3 className="pricing-compare-title">Compare plans</h3>
          <div className="pricing-compare-scroll">
            <table className="pricing-compare-table">
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  <th scope="col">Wanderer</th>
                  <th scope="col">Voyager</th>
                  <th scope="col">Trailblazer</th>
                  <th scope="col">Founder</th>
                </tr>
              </thead>
              <tbody>
                {TIER_FEATURE_COMPARISON.map(row => (
                  <tr key={row.id}>
                    <th scope="row">{row.label}</th>
                    <td><FeatureCell value={row.wanderer} /></td>
                    <td><FeatureCell value={row.voyager} /></td>
                    <td><FeatureCell value={row.trailblazer} /></td>
                    <td><FeatureCell value={row.founder} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
