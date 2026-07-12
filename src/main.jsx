import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "https://1c6a3daa0e336e04d6aa20824b1d08a4@o4511719041794048.ingest.us.sentry.io/4511719050051584",
});

import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import PulsingWordmark from "./components/PulsingWordmark.jsx";

const App = lazy(() => import("./App.jsx"));
const NeonPopupShowcase = lazy(() => import("./components/dev/NeonPopupShowcase.jsx"));
import { initViewportLayout } from "./lib/viewportLayout.js";
import { syncSkyCycle } from "./lib/surfaceTheme.js";
import { computeAutoTheme } from "./lib/theme.js";
import { initPwaInstall } from "./lib/pwaInstall.js";
import "./index.css";
import "./components.css";
import "./styles/tripmappa.css";
import "./styles/tripmappa-themes.css";
import "./styles/rebrand.css";
import "./styles/brand-typography.css";
import "./styles/hero-map-theme.css";
import "./styles/live-map-mesh.css";
import "./styles/mobile-layout.css";
import "./styles/hero-mountain.css";
/* Web vs mobile split at 769px — load after mobile-layout */
import "./styles/hero-desktop.css";
import "./styles/hero-palette.css";
import "./styles/hero-surface.css";
import "./styles/plan-flow-theme.css";
import "./styles/search-bar-animated.css";
import "./styles/pricing-plates.css";
import "./styles/preference-pills.css";
import "./styles/neon-sign-popup.css";
import "./styles/road-trip-stop-card.css";
import "./styles/micro-animations.css";

function SentryAppFallback({ error, resetError }) {
  return (
    <div className="error-boundary-fallback" role="alert">
      <p className="error-boundary-title">TripMappa ran into a problem</p>
      <p className="error-boundary-msg">{error?.message || "An unexpected error occurred."}</p>
      <button type="button" className="error-boundary-retry" onClick={resetError}>
        Try again
      </button>
    </div>
  );
}

function syncAppHeight() {
  document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
}

syncAppHeight();
window.addEventListener("orientationchange", syncAppHeight);

initViewportLayout();
syncSkyCycle({ theme: computeAutoTheme() });
initPwaInstall();
sessionStorage.removeItem("tm-chunk-reload");

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary label="app-root" title="TripMappa ran into a problem">
      <AuthProvider>
        <ThemeProvider>
          <Suspense fallback={<PulsingWordmark size="lg" />}>
            {typeof window !== "undefined" && window.location.search.includes("neon-showcase") ? (
              <NeonPopupShowcase />
            ) : (
              <Sentry.ErrorBoundary fallback={SentryAppFallback}>
                <App />
              </Sentry.ErrorBoundary>
            )}
          </Suspense>
          <Analytics />
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>
);
