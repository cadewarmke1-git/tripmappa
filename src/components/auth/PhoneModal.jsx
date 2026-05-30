import { useState } from "react";
import { useDialogA11y } from "../../hooks/useDialogA11y.js";
import ModalCloseButton from "../ModalCloseButton.jsx";

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.5 3h3l1.5 5-2 1.2a13 13 0 0 0 5.8 5.8L16 13l5 1.5v3A16.5 16.5 0 0 1 3 6.5L6.5 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PhoneModal({
  onClose,
  onSendCode,
  onVerifyCode,
  onResendCode,
  loading = false,
  error = "",
  initialPhone = "",
}) {
  const [step, setStep] = useState(initialPhone ? "code" : "phone");
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState("");
  const dialogRef = useDialogA11y(true, onClose, "phone-signin-headline");

  async function handleSend(e) {
    e?.preventDefault();
    const ok = await onSendCode?.(phone);
    if (ok !== false) {
      setStep("code");
      setCode("");
    }
  }

  async function handleVerify(e) {
    e?.preventDefault();
    await onVerifyCode?.(phone, code);
  }

  async function handleResend() {
    await onResendCode?.(phone);
    setCode("");
  }

  return (
    <div className="modal-overlay auth-modal-overlay" role="presentation" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={dialogRef}
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="phone-signin-headline"
      >
        <ModalCloseButton onClose={onClose} />
        <div className="auth-modal-gold-border" aria-hidden="true"/>
        <div className="auth-modal-logo">Trip<span>Mappa</span></div>

        {step === "phone" ? (
          <>
            <h2 className="auth-modal-headline" id="phone-signin-headline">Sign in with your phone.</h2>
            <p className="auth-modal-sub">We&apos;ll text you a 6-digit code to verify your number.</p>
            <form className="auth-modal-form" onSubmit={handleSend}>
              <label className="auth-field-label" htmlFor="phone-signin">Phone number</label>
              <div className="auth-phone-row">
                <select className="auth-phone-country" defaultValue="+1" disabled aria-label="Country code">
                  <option value="+1">+1 US</option>
                </select>
                <input
                  id="phone-signin"
                  type="tel"
                  inputMode="numeric"
                  className="auth-field-input auth-phone-input"
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  autoComplete="tel-national"
                  disabled={loading}
                />
              </div>
              {error && <p className="auth-modal-error">{error}</p>}
              <button type="submit" className="btn-generate auth-modal-submit" disabled={loading}>
                {loading ? "Sending code…" : "Send Code →"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="auth-modal-headline">Enter your code.</h2>
            <p className="auth-modal-sub">Sent to +1 {phone.replace(/\D/g, "").slice(-10)}</p>
            <form className="auth-modal-form" onSubmit={handleVerify}>
              <label className="auth-field-label" htmlFor="phone-otp">Verification code</label>
              <input
                id="phone-otp"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                className="auth-field-input auth-otp-input"
                placeholder="6-digit code"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                autoComplete="one-time-code"
                disabled={loading}
              />
              {error && <p className="auth-modal-error">{error}</p>}
              <button type="submit" className="btn-generate auth-modal-submit" disabled={loading || code.length !== 6}>
                {loading ? "Verifying…" : "Verify & Sign In →"}
              </button>
              <button type="button" className="auth-modal-link-btn auth-resend-btn" onClick={handleResend} disabled={loading}>
                Resend Code
              </button>
              <button type="button" className="auth-modal-link-btn" onClick={() => { setStep("phone"); setCode(""); }} disabled={loading}>
                Change number
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export { PhoneIcon };
