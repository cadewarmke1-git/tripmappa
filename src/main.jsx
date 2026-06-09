import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import RouteDrawingLoader from "./components/RouteDrawingLoader.jsx";

const App = lazy(() => import("./App.jsx"));
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
          <Suspense fallback={<RouteDrawingLoader theme="night" variant="inline" />}>
            <App />
          </Suspense>
          <Analytics />
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>
);
