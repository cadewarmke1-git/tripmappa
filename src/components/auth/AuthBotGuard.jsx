/**
 * Lightweight bot guard for email auth forms.
 * - Always: honeypot field (bots fill it; humans never see it)
 * - Optional: Cloudflare Turnstile when VITE_TURNSTILE_SITE_KEY is set
 */
import { useEffect, useRef, useState } from "react";

const TURNSTILE_SITE_KEY = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || "").trim();

export function isTurnstileConfigured() {
  return Boolean(TURNSTILE_SITE_KEY);
}

export default function AuthBotGuard({
  honeypotValue,
  onHoneypotChange,
  onCaptchaToken,
  disabled = false,
  inputId = "auth-company-website",
}) {
  const [scriptReady, setScriptReady] = useState(false);
  const onCaptchaTokenRef = useRef(onCaptchaToken);
  onCaptchaTokenRef.current = onCaptchaToken;

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || typeof window === "undefined") return undefined;

    const existing = document.querySelector("script[data-tripmappa-turnstile]");
    if (existing) {
      setScriptReady(true);
      return undefined;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.tripmappaTurnstile = "1";
    script.onload = () => setScriptReady(true);
    document.head.appendChild(script);
    return undefined;
  }, []);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !scriptReady || typeof window === "undefined") return undefined;
    const turnstile = window.turnstile;
    if (!turnstile?.render) return undefined;

    const el = document.getElementById("tripmappa-turnstile");
    if (!el || el.dataset.rendered === "1") return undefined;

    const widgetId = turnstile.render(el, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token) => onCaptchaTokenRef.current?.(token || ""),
      "expired-callback": () => onCaptchaTokenRef.current?.(""),
      "error-callback": () => onCaptchaTokenRef.current?.(""),
    });
    el.dataset.rendered = "1";
    el.dataset.widgetId = String(widgetId);

    return () => {
      try {
        turnstile.remove(widgetId);
      } catch {
        /* ignore */
      }
      el.dataset.rendered = "0";
    };
  }, [scriptReady]);

  return (
    <>
      <div className="auth-honeypot" aria-hidden="true">
        <label htmlFor={inputId}>Company website</label>
        <input
          id={inputId}
          name="company_website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypotValue}
          disabled={disabled}
          onChange={(e) => onHoneypotChange?.(e.target.value)}
        />
      </div>
      {TURNSTILE_SITE_KEY ? (
        <div id="tripmappa-turnstile" className="auth-turnstile" />
      ) : null}
    </>
  );
}
