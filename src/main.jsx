import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { initViewportLayout } from "./lib/viewportLayout.js";
import { initPwaInstall } from "./lib/pwaInstall.js";
import "./index.css";
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

initViewportLayout();
initPwaInstall();

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
          <App />
          <Analytics />
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>
);
