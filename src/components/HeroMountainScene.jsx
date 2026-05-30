import { useEffect, useState } from "react";
import { buildStarField, resolveSkyPhase, SKY_CHECK_MS } from "../lib/skyTime.js";

const STARS = buildStarField(52);

export default function HeroMountainScene({ theme = "night", themeLocked = false }) {
  const [phase, setPhase] = useState(() => resolveSkyPhase({ theme, themeLocked }));

  useEffect(() => {
    const tick = () => setPhase(resolveSkyPhase({ theme, themeLocked }));
    tick();
    const id = setInterval(tick, SKY_CHECK_MS);
    return () => clearInterval(id);
  }, [theme, themeLocked]);

  const showStars = phase === "night" || phase === "pre_dawn";

  const farRangeFill = theme === "day" ? "#3A2010" : "#2A1A4A";
  const nearRangeFill = theme === "day" ? "#1A0D00" : "#0D0A1A";

  return (
    <div className={`hero-mountain-scene hero-mountain-scene--${phase} hero-mountain-scene--theme-${theme}`} aria-hidden="true">
      <div className="hero-sky-layer" />
      {showStars && (
        <svg className="hero-stars" viewBox="0 0 100 100" preserveAspectRatio="none">
          {STARS.map(star => (
            <circle
              key={star.id}
              cx={star.x}
              cy={star.y}
              r={star.r * 0.15}
              fill="#FFFFFF"
              opacity={star.opacity}
            />
          ))}
        </svg>
      )}
      <svg className="hero-mountains" viewBox="0 0 1440 420" preserveAspectRatio="none">
        <path
          className="hero-mountain-far"
          fill={farRangeFill}
          d="M0,420 L0,260 C120,220 200,180 320,200 C440,220 520,140 640,160 C760,180 860,120 980,150 C1100,180 1200,100 1320,130 L1440,110 L1440,420 Z"
        />
        <path
          className="hero-mountain-near"
          fill={nearRangeFill}
          d="M0,420 L0,320 C180,300 280,260 420,280 C560,300 680,240 820,270 C960,300 1080,250 1240,290 L1440,310 L1440,420 Z"
        />
      </svg>
    </div>
  );
}
