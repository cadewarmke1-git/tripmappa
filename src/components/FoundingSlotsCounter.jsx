import { useEffect, useState } from "react";
import { fetchFoundingSlotsRemaining } from "../lib/foundingSlotsApi.js";
import { FOUNDER_MEMBER_LIMIT } from "../lib/tiers.js";

const POLL_MS = 20000;

/** Prominent Founder tier spots-remaining counter. */
export default function FoundingSlotsCounter({ variant = "hero", className = "" }) {
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchFoundingSlotsRemaining();
        if (!cancelled) setRemaining(data.remaining);
      } catch {
        if (!cancelled) setRemaining(null);
      }
    }

    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (remaining == null) return null;

  const claimed = Math.max(0, FOUNDER_MEMBER_LIMIT - remaining);

  if (variant === "pricing") {
    return (
      <div className={`pricing-founder-counter${className ? ` ${className}` : ""}`} aria-live="polite">
        <span className="pricing-founder-counter-label">Limited-time Founder offer</span>
        <span className="pricing-founder-counter-spots">
          <strong>{remaining.toLocaleString()}</strong> of {FOUNDER_MEMBER_LIMIT.toLocaleString()} spots left
        </span>
        <span className="pricing-founder-counter-sub">
          {claimed.toLocaleString()} founding members joined · 1 year Trailblazer free
        </span>
      </div>
    );
  }

  return (
    <div className={`hero-founding-badge${className ? ` ${className}` : ""}`} aria-live="polite">
      <span className="hero-founding-badge-label">Founder — first {FOUNDER_MEMBER_LIMIT.toLocaleString()} users</span>
      <span className="hero-founding-badge-sep" aria-hidden="true">·</span>
      <span className="hero-founding-badge-count">
        {remaining.toLocaleString()} spots remaining
      </span>
    </div>
  );
}
