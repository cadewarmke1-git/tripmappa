import { useMemo } from "react";
import { MTN_FAR, MTN_MID, MTN_NEAR, MTN_SNOW } from "../lib/heroMountainPaths.js";
import { buildStarField, getSkyAtmosphere, SKY_PHASES } from "../lib/skyTime.js";

const STARS = buildStarField(72);

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
              cx={star.x}
              cy={star.y}
              r={star.r * 0.12}
              fill="#FFFFFF"
              opacity={star.opacity}
            />
          ))}
        </svg>
      )}

      <div className="hero-sun-halo" />
      <div className="hero-sun-disc" />
      <div className="hero-moon-disc" />

      {showClouds && (
        <div className="hero-clouds" aria-hidden="true">
          <div className="hero-cloud hero-cloud--a" />
          <div className="hero-cloud hero-cloud--b" />
          <div className="hero-cloud hero-cloud--c" />
        </div>
      )}

      <svg
        className="hero-mountains"
        viewBox="0 0 1440 520"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        <path className="hero-mtn hero-mtn--far" d={MTN_FAR} />
        <path className="hero-mtn hero-mtn--mid" d={MTN_MID} />
        <path className="hero-mtn hero-mtn--near" d={MTN_NEAR} />
        <path className="hero-mtn-snow" d={MTN_SNOW} />
      </svg>

      <div className="hero-ridge-glow" aria-hidden="true" />
      <div className="hero-cloud-sea" aria-hidden="true" />
    </div>
  );
}
