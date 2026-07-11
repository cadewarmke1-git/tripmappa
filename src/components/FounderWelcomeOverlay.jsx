import { useEffect, useMemo } from "react";
import { useDialogA11y } from "../hooks/useDialogA11y.js";

export default function FounderWelcomeOverlay({ firstName, onDismiss }) {
  const displayName = useMemo(() => {
    const trimmed = (firstName || "").trim();
    return trimmed || "Explorer";
  }, [firstName]);
  const dialogRef = useDialogA11y(true, onDismiss, "founder-welcome-title");

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss?.(), 4000);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return (
    <dialog
      ref={dialogRef}
      className="founder-welcome-overlay"
      aria-labelledby="founder-welcome-title"
      onClick={() => onDismiss?.()}
    >
      <div className="founder-welcome-particles" aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => (
          <span key={i} className="founder-welcome-particle" style={{ "--i": i }} />
        ))}
      </div>
      <div className="founder-welcome-card" onClick={e => e.stopPropagation()}>
        <p className="founder-welcome-eyebrow">Founding Member</p>
        <h1 id="founder-welcome-title" className="founder-welcome-title">
          Welcome, {displayName}
        </h1>
        <p className="founder-welcome-sub">
          You&apos;re one of the first 1,000 members — enjoy one year of Trailblazer free.
          Your Founder badge is yours permanently.
        </p>
        <p className="founder-welcome-hint">Tap anywhere to continue</p>
      </div>
    </dialog>
  );
}
