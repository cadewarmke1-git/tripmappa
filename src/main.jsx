import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "./context/AuthContext.jsx";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./index.css";
import "./styles/tripmappa.css";
import "./styles/tripmappa-themes.css";
import "./styles/rebrand.css";
import "./styles/brand-typography.css";
import "./styles/hero-map-theme.css";
import "./styles/live-map-mesh.css";
import "./styles/mobile-layout.css";
import "./styles/hero-mountain.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary label="app-root" title="TripMappa ran into a problem">
      <AuthProvider>
        <App />
        <Analytics />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>
);
