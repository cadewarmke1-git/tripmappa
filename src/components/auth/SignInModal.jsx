import { useState } from "react";
import { useDialogA11y } from "../../hooks/useDialogA11y.js";
import AuthSocialButtons, { SOCIAL_AUTH_UI_ENABLED } from "./AuthSocialButtons.jsx";
import ModalCloseButton from "../ModalCloseButton.jsx";
import RouteDrawingLoader from "../RouteDrawingLoader.jsx";
import BrandWordmark from "../BrandWordmark.jsx";

export default function SignInModal({
  onClose,
  onSignIn,
  onForgotPassword,
  onSwitchToSignup,
  onGoogle,
  onFacebook,
  onApple,
  loading = false,
  error = "",
  theme = "night",
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const dialogRef = useDialogA11y(true, onClose, "signin-headline");

  function handleSubmit(e) {
    e?.preventDefault();
    onSignIn?.({ email, password });
  }

  return (
    <div className="modal-overlay auth-modal-overlay" role="presentation" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={dialogRef}
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-headline"
      >
        <ModalCloseButton onClose={onClose} />
        <div className="auth-modal-gold-border" aria-hidden="true"/>
        <BrandWordmark className="auth-modal-logo" as="div" />
        <h2 className="auth-modal-headline" id="signin-headline">Welcome back.</h2>
        <p className="auth-modal-sub">Sign in to pick up where you left off.</p>

        <form className="auth-modal-form" onSubmit={handleSubmit}>
          <label className="auth-field-label" htmlFor="signin-email">Email</label>
          <input
            id="signin-email"
            type="email"
            className="auth-field-input"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            disabled={loading}
          />
          <label className="auth-field-label" htmlFor="signin-password">Password</label>
          <input
            id="signin-password"
            type="password"
            className="auth-field-input"
            placeholder="Your password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={loading}
          />
          <button type="button" className="auth-forgot-link" onClick={() => onForgotPassword?.(email)} disabled={loading}>
            Forgot password?
          </button>
          {error && <p className="auth-modal-error">{error}</p>}
          <button type="submit" className="btn-generate auth-modal-submit" disabled={loading}>
            {loading ? <RouteDrawingLoader variant="button" /> : "Sign In →"}
          </button>
          <p className="auth-modal-footer">
            By continuing you agree to our{" "}
            <a href="/terms" className="auth-modal-link-btn">Terms of Service</a>
            {" "}and{" "}
            <a href="/privacy" className="auth-modal-link-btn">Privacy Policy</a>.
          </p>
        </form>

        {SOCIAL_AUTH_UI_ENABLED && (
          <>
            <div className="auth-modal-divider"><span>or sign in with</span></div>
            <AuthSocialButtons onGoogle={onGoogle} onFacebook={onFacebook} onApple={onApple} compact disabled={loading}/>
          </>
        )}
        <p className="auth-modal-footer">
          New here?{" "}
          <button type="button" className="auth-modal-link-btn" onClick={onSwitchToSignup} disabled={loading}>Create an account</button>
        </p>
      </div>
    </div>
  );
}
