/** First-step invitation for guests — account required before planning. */
import { triggerPrimaryHaptic } from "../lib/haptic.js";

export default function PlanGuestInvite({ onSignUp, onSignIn }) {
  return (
    <div className="plan-guest-invite">
      <div className="plan-flow-confirm-panel plan-guest-invite-panel">
        <p className="plan-guest-invite-lead">
          Sign up free to save this trip
        </p>
        <p className="plan-flow-question-hint plan-guest-invite-detail">
          We&apos;ll save your route and answers so you can pick up anytime.
        </p>
      </div>
      <div className="plan-guest-invite-actions">
        <button
          type="button"
          className="btn-generate btn-generate-inline plan-guest-invite-primary"
          onClick={() => { triggerPrimaryHaptic(); onSignUp?.(); }}
        >
          Sign up free
        </button>
        <button
          type="button"
          className="convo-nav-btn plan-guest-invite-secondary"
          onClick={() => { triggerPrimaryHaptic(); onSignIn?.(); }}
        >
          Sign in
        </button>
      </div>
    </div>
  );
}
