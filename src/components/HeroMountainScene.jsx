import { useMemo } from "react";
import { HERO_PHOTO } from "../lib/constants.js";
import { buildStarField, getSkyAtmosphere, SKY_PHASES } from "../lib/skyTime.js";

const STARS = buildStarField(110, 42).map((star, i) => ({
  ...star,
  twinkleDur: star.tier === "bright" ? 3.2 + (i % 5) * 0.4 : 2.6 + (i % 7) * 0.5,
  twinkleDelay: (i * 0.27) % 5,
}));

const CLOUD_CLUSTERS = ["a", "b", "c", "d"];

export default function HeroMountainScene({ phase = SKY_PHASES.night, hour = 12 }) {
  const atmosphere = useMemo(() => getSkyAtmosphere(hour), [hour]);
  const showStars = atmosphere.starOpacity > 0.04;
  const showClouds = atmosphere.cloudOpacity > 0.05;

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

        <div className="hero-sun">
          <div className="hero-sun-corona" />
          <div className="hero-sun-halo" />
          <div className="hero-sun-disc">
            <div className="hero-sun-core" />
          </div>
        </div>

        <div className="hero-moon">
          <div className="hero-moon-halo" />
          <div className="hero-moon-disc">
            <div className="hero-moon-shade" />
            <div className="hero-moon-crater hero-moon-crater--a" />
            <div className="hero-moon-crater hero-moon-crater--b" />
            <div className="hero-moon-crater hero-moon-crater--c" />
          </div>
        </div>

        {showClouds && (
          <div className="hero-clouds" aria-hidden="true">
            {CLOUD_CLUSTERS.map(id => (
              <div key={id} className={`hero-cloud-cluster hero-cloud-cluster--${id}`}>
                <span className="hero-cloud-puff hero-cloud-puff--1" />
                <span className="hero-cloud-puff hero-cloud-puff--2" />
                <span className="hero-cloud-puff hero-cloud-puff--3" />
                <span className="hero-cloud-puff hero-cloud-puff--4" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="hero-photo-layer">
        <div
          className="hero-photo-slide"
          style={{ backgroundImage: `url(${HERO_PHOTO})` }}
        />
        <div className="hero-photo-tint" aria-hidden="true" />
        <div className="hero-peak-haze" aria-hidden="true" />
        <div className="hero-ridge-bleed" aria-hidden="true" />
      </div>
    </div>
  );
}
