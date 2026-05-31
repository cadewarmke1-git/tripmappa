import BrandWordmark from "./BrandWordmark.jsx";
import { HERO_SURFACE_PALETTE } from "../lib/palette.js";

const HERO_WORDMARK_STYLE = {
  display: "inline-block",
  backgroundClip: "text",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  color: "transparent",
};

/** Clickable TripMappa wordmark — navigates home from any screen. */
export default function NavLogo({ onClick, className = "", theme }) {
  const heroPalette = theme ? HERO_SURFACE_PALETTE[theme] : null;

  return (
    <button
      type="button"
      className={`nav-logo nav-logo-home${className ? ` ${className}` : ""}`}
      onClick={onClick}
      aria-label="TripMappa home"
    >
      <BrandWordmark
        as="span"
        style={
          heroPalette
            ? { ...HERO_WORDMARK_STYLE, background: heroPalette.wordmarkGradient }
            : undefined
        }
      />
    </button>
  );
}
