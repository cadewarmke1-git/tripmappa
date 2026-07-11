import { useState } from "react";
import { useDialogA11y } from "../hooks/useDialogA11y.js";
import AuthSocialButtons, { SOCIAL_AUTH_UI_ENABLED } from "./auth/AuthSocialButtons.jsx";
import { PhoneIcon } from "./auth/PhoneModal.jsx";
import ModalCloseButton from "./ModalCloseButton.jsx";
import GoldSpinner from "./GoldSpinner.jsx";
import BrandWordmark from "./BrandWordmark.jsx";

export default function EmailModal({
  email,
  onEmailChange,
  onClose,
  onSignUp,
  onSwitchToSignIn,
  onGoogle,
  onFacebook,
  onApple,
  onContinueWithPhone,
  loading = false,
  error = "",
  lead = "",
  theme = "night",
}) {
  const [password, setPassword] = useState("");
  const dialogRef = useDialogA11y(true, onClose, "signup-headline");

  function handleSubmit(e) {
    e?.preventDefault();
    onSignUp?.({ email, password });
  }

  return (
    <dialog
      ref={dialogRef}
      className="modal-overlay auth-modal-overlay"
      aria-labelledby="signup-headline"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <ModalCloseButton onClose={onClose} />
        <div className="auth-modal-gold-border" aria-hidden="true"/>
        <BrandWordmark className="auth-modal-logo" as="div" />
        <h2 className="auth-modal-headline" id="signup-headline">Start planning your perfect trip.</h2>
        <p className="auth-modal-sub">{lead || "Create your free account to save trips, share routes, and unlock premium features."}</p>

        <form className="auth-modal-form" onSubmit={handleSubmit}>
          <label className="auth-field-label" htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
            type="email"
            className="auth-field-input"
            placeholder="you@example.com"
            value={email}
            onChange={e => onEmailChange(e.target.value)}
            autoComplete="email"
            disabled={loading}
          />
          <label className="auth-field-label" htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            type="password"
            className="auth-field-input"
            placeholder="At least 8 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            disabled={loading}
          />
          {error && <p className="auth-modal-error">{error}</p>}
          <button type="submit" className="btn-generate auth-modal-submit" disabled={loading}>
            {loading ? <GoldSpinner size="button" /> : "Create My Account →"}
          </button>
          <p className="auth-modal-footer">
            By continuing you agree to our{" "}
            <a href="/terms" className="auth-modal-link-btn">Terms of Service</a>
            {" and "}
            <span className="auth-modal-footer-end">
              <a href="/privacy" className="auth-modal-link-btn">Privacy Policy</a>.
            </span>
          </p>
        </form>

        <div className="auth-modal-divider"><span>or</span></div>
        <button type="button" className="hero-email-btn auth-modal-alt-btn" onClick={onContinueWithPhone} disabled={loading}>
          <PhoneIcon /> Continue with phone
        </button>

        {SOCIAL_AUTH_UI_ENABLED && (
          <>
            <div className="auth-modal-divider"><span>or sign in with</span></div>
            <AuthSocialButtons onGoogle={onGoogle} onFacebook={onFacebook} onApple={onApple} compact disabled={loading}/>
          </>
        )}

        <p className="auth-modal-footer">
          Already have an account?{" "}
          <button type="button" className="auth-modal-link-btn" onClick={onSwitchToSignIn} disabled={loading}>Sign in.</button>
        </p>
      </div>
    </dialog>
  );
}
