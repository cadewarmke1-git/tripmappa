import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import BrandWordmark from "../components/BrandWordmark.jsx";
import PricingPlans from "../components/PricingPlans.jsx";
import { createCheckoutSession, createVoyagerCheckoutSession } from "../lib/stripeApi.js";
import { TIERS } from "../lib/tiers.js";

export default function PricingPage() {
  const { theme } = useTheme();
  const { user, session } = useAuth();
  const [billingInterval, setBillingInterval] = useState("month");
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  async function startCheckout(tier) {
    if (!user?.id || !session?.access_token) {
      window.location.href = "/";
      return;
    }
    setCheckoutError("");
    setCheckoutLoading(true);
    try {
      const payload = { userId: user.id, email: user.email || undefined, billingInterval };
      const startCheckoutFn = tier === TIERS.VOYAGER
        ? createVoyagerCheckoutSession
        : createCheckoutSession;
      const { url } = await startCheckoutFn(session.access_token, payload);
      if (url) {
        window.location.href = url;
        return;
      }
      throw new Error("Could not start checkout");
    } catch (err) {
      setCheckoutError(err.message || "Could not start checkout");
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <div className={`app-wrap pricing-page ${theme}`}>
      <header className="pricing-page-header">
        <a href="/" className="pricing-page-home" aria-label="TripMappa home">
          <BrandWordmark />
        </a>
        <nav className="pricing-page-nav" aria-label="Site">
          <a href="/">Plan a trip</a>
          {!user && <a href="/">Sign in</a>}
        </nav>
      </header>

      <main className="pricing-page-main">
        <header className="pricing-page-intro">
          <p className="pricing-page-eyebrow">Fuel up your journey</p>
          <h1 className="pricing-page-title">Pick your travel pass</h1>
          <p className="pricing-page-lead">
            Every road trip starts with the right plan. Upgrade any time.
          </p>
        </header>

        <PricingPlans
          billingInterval={billingInterval}
          onBillingChange={setBillingInterval}
          sections={{
            showBillingToggle: false,
            showComparison: false,
            showFounder: true,
          }}
          onGetStarted={() => { window.location.href = "/"; }}
          onSignIn={() => { window.location.href = "/"; }}
          onUpgradeVoyager={() => startCheckout(TIERS.VOYAGER)}
          onUpgradeTrailblazer={() => startCheckout(TIERS.TRAILBLAZER)}
        />

        {checkoutLoading && (
          <p className="pricing-page-status" aria-live="polite">Starting secure checkout…</p>
        )}
        {checkoutError && (
          <p className="pricing-page-error" role="alert">{checkoutError}</p>
        )}

        <p className="pricing-page-footnote">
          Paid plans renew monthly or annually via Stripe. Cancel anytime from your profile.
          Founder members receive one year of Trailblazer at no charge; the Founder badge stays on your profile permanently.
        </p>
      </main>
    </div>
  );
}
