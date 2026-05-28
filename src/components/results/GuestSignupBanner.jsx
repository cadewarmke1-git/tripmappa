export default function GuestSignupBanner({ onSignUp, onDismiss }) {
  return (
    <div className="guest-signup-banner">
      <p className="guest-signup-banner-text">
        Sign up free to save this trip and get 3 Trip Generations per month
      </p>
      <div className="guest-signup-banner-actions">
        <button type="button" className="guest-signup-banner-btn" onClick={onSignUp}>Sign Up</button>
        <button type="button" className="guest-signup-banner-close" onClick={onDismiss} aria-label="Dismiss">×</button>
      </div>
    </div>
  );
}
