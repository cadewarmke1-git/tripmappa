import BrandWordmark from "./BrandWordmark.jsx";
import { GOLD_PRIMARY, ORANGE_PRIMARY } from "../lib/palette.js";
const ROUTE_PATH =
  "M 12 38 C 36 38, 48 10, 72 14 S 108 42, 138 26 S 176 10, 188 18";

function resolveTheme(theme) {
  if (theme === "day" || theme === "night") return theme;
  if (typeof document === "undefined") return "night";
  if (document.querySelector(".app-wrap.day, .hero.day, .live-view-page-day")) return "day";
  if (document.querySelector(".app-wrap.night, .hero.night, .live-view-page-night")) return "night";
  return "night";
}

export default function RouteDrawingLoader({ theme, variant = "inline", className = "" }) {
  const resolvedTheme = resolveTheme(theme);
  const gradId = `routeLoaderGrad-${variant}-${resolvedTheme}`;
  const showWordmark = variant !== "compact" && variant !== "button";
  const rootClass = [
    "route-drawing-loader",
    `route-drawing-loader--${variant}`,
    `route-drawing-loader--${resolvedTheme}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass} role="status" aria-busy="true" aria-label="Loading">
      <div className="route-drawing-loader-inner">
        <svg
          className="route-drawing-loader-svg"
          viewBox="0 0 200 48"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={GOLD_PRIMARY} />
              <stop offset="100%" stopColor={ORANGE_PRIMARY} />
            </linearGradient>
          </defs>
          <path
            className="route-drawing-loader-path"
            d={ROUTE_PATH}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="3"
            strokeLinecap="round"
            pathLength="1"
          />
        </svg>
        {showWordmark && (
          <BrandWordmark className="route-drawing-loader-wordmark" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
