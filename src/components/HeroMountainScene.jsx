import { useEffect, useState } from "react";
import HeroPhotoSlideshow from "./HeroPhotoSlideshow.jsx";
import { HERO_PHOTOS_DAY, HERO_PHOTOS_NIGHT } from "../lib/constants.js";
import { buildStarField, resolveSkyPhase, SKY_CHECK_MS } from "../lib/skyTime.js";

const STARS = buildStarField(52);

export default function HeroMountainScene({
  theme = "night",
  themeLocked = false,
  photoPaused = false,
}) {
  const [phase, setPhase] = useState(() => resolveSkyPhase({ theme, themeLocked }));

  useEffect(() => {
    const tick = () => setPhase(resolveSkyPhase({ theme, themeLocked }));
    tick();
    const id = setInterval(tick, SKY_CHECK_MS);
    return () => clearInterval(id);
  }, [theme, themeLocked]);

  const showStars = phase === "night" || phase === "pre_dawn";
  const isDay = theme === "day";

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

      <div
        className="hero-photo-set hero-photo-set--day"
        style={{ opacity: isDay ? 1 : 0, pointerEvents: isDay ? "auto" : "none" }}
      >
        <HeroPhotoSlideshow photos={HERO_PHOTOS_DAY} paused={photoPaused} active={isDay} />
      </div>
      <div
        className="hero-photo-set hero-photo-set--night"
        style={{ opacity: isDay ? 0 : 1, pointerEvents: isDay ? "none" : "auto" }}
      >
        <HeroPhotoSlideshow photos={HERO_PHOTOS_NIGHT} paused={photoPaused} active={!isDay} />
      </div>

      <div className="hero-horizon-blend" aria-hidden="true" />
    </div>
  );
}
