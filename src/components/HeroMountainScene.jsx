import { useMemo } from "react";
import { HERO_PHOTO } from "../lib/constants.js";
import { buildStarField, getSkyAtmosphere, SKY_PHASES } from "../lib/skyTime.js";

const STARS = buildStarField(110, 42).map((star, i) => ({
  ...star,
  twinkleDur: star.tier === "bright" ? 3.2 + (i % 5) * 0.4 : 2.6 + (i % 7) * 0.5,
  twinkleDelay: (i * 0.27) % 5,
}));

export default function HeroMountainScene({ phase = SKY_PHASES.night, hour = 12 }) {
  const atmosphere = useMemo(() => getSkyAtmosphere(hour), [hour]);
  const showStars = atmosphere.starOpacity > 0.04;

  return (
    <div
      className={`hero-mountain-scene hero-mountain-scene--${phase}`}
      style={atmosphere.cssVars}
      aria-hidden="true"
    >
      <div className="hero-sky-gradient" />

      <div className="hero-sky-celestial">
        <div className="hero-milky-way" aria-hidden="true" />

        {showStars && (
          <svg
            className="hero-stars"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ opacity: atmosphere.starOpacity }}
          >
            {STARS.map(star => (
              <circle
                key={star.id}
                className={`hero-star hero-star--${star.tier}${star.twinkle ? " hero-star--twinkle" : ""}`}
                cx={star.x}
                cy={star.y}
                r={star.r * 0.1}
                fill="#FFFFFF"
                opacity={star.opacity}
                style={
                  star.twinkle
                    ? {
                        animationDuration: `${star.twinkleDur}s`,
                        animationDelay: `${star.twinkleDelay}s`,
                      }
                    : undefined
                }
              />
            ))}
          </svg>
        )}
      </div>

      <div className="hero-photo-layer">
        <div
          className="hero-photo-slide"
          style={{ backgroundImage: `url(${HERO_PHOTO})` }}
        />
        <div className="hero-photo-tint" aria-hidden="true" />
        <div className="hero-photo-night-veil" aria-hidden="true" />
        <div className="hero-photo-day-veil" aria-hidden="true" />
      </div>
    </div>
  );
}
