import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App.jsx";
import "./index.css";
import "./styles/tripmappa.css";
import "./styles/tripmappa-themes.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>
);
