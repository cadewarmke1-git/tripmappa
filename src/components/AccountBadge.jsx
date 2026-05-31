import { useEffect, useRef, useState } from "react";
import { getTierLabel, hasUnlimitedTripGenerations, normalizeTier } from "../lib/tiers.js";

export default function AccountBadge({ user, creditStatus, onSignOut, onRefreshCredits }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const displayName = user?.user_metadata?.full_name
    || user?.email?.split("@")[0]
    || "Account";
  const email = user?.email || "";
  const tierKey = normalizeTier(creditStatus?.tier);
  const tier = getTierLabel(tierKey);
  const isPaid = hasUnlimitedTripGenerations(tierKey);
  const generationsLabel = isPaid
    ? "Unlimited Trip Generations"
    : `${creditStatus?.remaining ?? 0} of ${creditStatus?.limit ?? 3} Trip Generations remaining this month`;

  useEffect(() => {
    if (!open) return;
    onRefreshCredits?.();
    const onPointerDown = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, onRefreshCredits]);

  return (
    <div className="account-badge-wrap" ref={wrapRef}>
      <button type="button" className="account-badge" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="account-badge-name">
          {isPaid && (
            <svg className="account-crown" width="14" height="14" viewBox="0 0 24 24" fill="#FFD28C" aria-hidden="true">
              <path d="M5 18h14l-1.5-9.5L12 10 7.5 8.5 5 18zM4 20h16v1H4v-1z"/>
            </svg>
          )}
          {displayName}
        </span>
        <span className="account-badge-tier">{tier}</span>
      </button>
      {open && (
        <div className="account-dropdown">
          <div className="account-dropdown-name">{displayName}</div>
          <div className="account-dropdown-email">{email}</div>
          <div className="account-dropdown-row">
            <span className="account-dropdown-label">Plan</span>
            <span className="account-dropdown-tier">{tier}</span>
          </div>
          <div className="account-dropdown-row">
            <span className="account-dropdown-label">Trip Generations</span>
            <span className="account-dropdown-val">{generationsLabel}</span>
          </div>
          <button type="button" className="account-dropdown-signout" onClick={() => { setOpen(false); onSignOut?.(); }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
