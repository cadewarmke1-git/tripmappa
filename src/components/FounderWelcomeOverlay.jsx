import { useEffect, useMemo } from "react";

export default function FounderWelcomeOverlay({ firstName, onDismiss }) {
  const displayName = useMemo(() => {
    const trimmed = (firstName || "").trim();
    return trimmed || "Explorer";
  }, [firstName]);

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss?.(), 4000);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className="founder-welcome-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="founder-welcome-title"
      onClick={() => onDismiss?.()}
      onKeyDown={e => {
        if (e.key === "Escape") onDismiss?.();
      }}
    >
      <div className="founder-welcome-particles" aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => (
          <span key={i} className="founder-welcome-particle" style={{ "--i": i }} />
        ))}
      </div>
      <div className="founder-welcome-card">
        <p className="founder-welcome-eyebrow">Founding Member</p>
        <h1 id="founder-welcome-title" className="founder-welcome-title">
          Welcome, {displayName}
        </h1>
        <p className="founder-welcome-sub">
          Thank you for being one of TripMappa&apos;s Founding Members.
        </p>
        <p className="founder-welcome-hint">Tap anywhere to continue</p>
      </div>
    </div>
  );
}
