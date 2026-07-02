import BillingToggle from "./BillingToggle.jsx";
import FoundingSlotsCounter from "./FoundingSlotsCounter.jsx";
import {
  TIERS,
  TIER_FEATURE_COMPARISON,
  formatTierPriceBlock,
  normalizeTier,
  isFounderTier,
} from "../lib/tiers.js";
import { PRICING_PLATE_TIERS, getPlatePriceDisplay } from "../lib/pricingTiers.js";

function FeatureCell({ value }) {
  if (value === true) {
    return <span className="pricing-compare-yes" aria-label="Included">✓</span>;
  }
  if (value === false) {
    return <span className="pricing-compare-no" aria-label="Not included">—</span>;
  }
  return <span className="pricing-compare-text">{value}</span>;
}

function RoutePinCheck({ accentVar }) {
  return (
    <svg
      className="pricing-plate-check"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      style={{ color: `var(${accentVar})` }}
    >
      <path
        d="M3.5 8.2 6.4 11 12.5 4.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlateRivet({ className = "" }) {
  return <span className={`pricing-plate-rivet${className ? ` ${className}` : ""}`} aria-hidden="true" />;
}

function PlateCard({
  tier,
  billingInterval,
  isCurrent,
  onCta,
  onGetStarted,
  onSignIn,
}) {
  const { price, per } = getPlatePriceDisplay(tier.id, billingInterval);
  const accentStyle = { "--plate-accent": `var(${tier.accentVar})` };

  function handleCta() {
    if (tier.id === TIERS.WANDERER) {
      (onGetStarted || onSignIn)?.();
      return;
    }
    onCta?.({ billingPeriod: billingInterval });
  }

  return (
    <article
      className={`pricing-plate-card${tier.primary ? " is-primary-tier" : ""}${isCurrent ? " is-current" : ""}`}
      style={accentStyle}
    >
      <span className="pricing-plate-rail" aria-hidden="true" />
      <PlateRivet className="pricing-plate-rivet--tl" />
      <PlateRivet className="pricing-plate-rivet--tr" />
      <PlateRivet className="pricing-plate-rivet--bl" />
      <PlateRivet className="pricing-plate-rivet--br" />

      {tier.ribbon && (
        <span className="pricing-plate-ribbon">{tier.ribbon}</span>
      )}

      <p className="pricing-plate-tag">{tier.tag}</p>
      <h3 className="pricing-plate-name">{tier.name}</h3>

      <div className="pricing-plate-price-row">
        <span className="pricing-plate-price">{price}</span>
        <span className="pricing-plate-per">{per}</span>
      </div>
      <p className="pricing-plate-allotment">{tier.allotment}</p>

      <div className="pricing-plate-divider" aria-hidden="true" />

      <ul className="pricing-plate-features">
        {tier.features.map(feature => (
          <li key={feature}>
            <RoutePinCheck accentVar={tier.accentVar} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <span className="pricing-plate-current">Your current plan</span>
      ) : (
        <button
          type="button"
          className={`pricing-plate-cta${tier.primary ? " pricing-plate-cta--primary" : ""}`}
          onClick={handleCta}
        >
          {tier.cta}
          {tier.id !== TIERS.WANDERER && billingInterval === "year" && (
            <> — {formatTierPriceBlock(tier.id, billingInterval).primary}</>
          )}
        </button>
      )}
    </article>
  );
}

function FounderPlate({ isCurrent, onClaim }) {
  return (
    <article className={`pricing-plate-founder${isCurrent ? " is-current" : ""}`}>
      <span className="pricing-plate-rail pricing-plate-rail--gold" aria-hidden="true" />
      <PlateRivet className="pricing-plate-rivet--tl" />
      <PlateRivet className="pricing-plate-rivet--tr" />
      <PlateRivet className="pricing-plate-rivet--bl" />
      <PlateRivet className="pricing-plate-rivet--br" />

      <div className="pricing-plate-founder-medallion" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
          <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17.8 5.8 21.3l2.4-7.4L2 9.4h7.6L12 2z" />
        </svg>
      </div>

      <div className="pricing-plate-founder-copy">
        <p className="pricing-plate-founder-kicker">Founding member</p>
        <h3 className="pricing-plate-name">Founder</h3>
        <p className="pricing-plate-founder-desc">
          First 1,000 travelers get <strong>1 full year of Trailblazer free</strong> plus a permanent gold star badge on your profile.
        </p>
      </div>

      <div className="pricing-plate-founder-actions">
        <FoundingSlotsCounter variant="plate" />
        {isCurrent ? (
          <span className="pricing-plate-current">You&apos;re a Founder</span>
        ) : (
          <button type="button" className="pricing-plate-cta pricing-plate-cta--primary" onClick={onClaim}>
            Claim founder spot
          </button>
        )}
      </div>
    </article>
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

  const ctaHandlers = {
    [TIERS.WANDERER]: null,
    [TIERS.VOYAGER]: onUpgradeVoyager,
    [TIERS.TRAILBLAZER]: onUpgradeTrailblazer,
  };

  function isCurrentTier(tierId) {
    if (isCurrentFounder && tierId === TIERS.TRAILBLAZER) return false;
    return normalizedCurrent === tierId;
  }

  const visibleTiers = PRICING_PLATE_TIERS.filter(t => showWanderer || t.id !== TIERS.WANDERER);

  return (
    <div className={`pricing-plates${compact ? " pricing-plates--compact" : ""}`}>
      {showBillingToggle && onBillingChange && (
        <div className="pricing-billing-row">
          <BillingToggle value={billingInterval} onChange={onBillingChange} />
          <p className="pricing-billing-hint">
            Annual billing saves 2 months — shown as the monthly equivalent below.
          </p>
        </div>
      )}

      <div className="pricing-plates-grid">
        {visibleTiers.map(tier => (
          <PlateCard
            key={tier.id}
            tier={tier}
            billingInterval={billingInterval}
            isCurrent={isCurrentTier(tier.id)}
            onCta={ctaHandlers[tier.id]}
            onGetStarted={onGetStarted}
            onSignIn={onSignIn}
          />
        ))}
      </div>

      {showFounder && (
        <FounderPlate
          isCurrent={isCurrentFounder}
          onClaim={onGetStarted || onSignIn}
        />
      )}

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
