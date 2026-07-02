import { useCallback, useState } from "react";

const HERO_DAY_PHOTO = "/hero/open-road-golden-hour.png";
const HERO_NIGHT_PHOTO = "/hero/open-road-twilight.png";

/**
 * Full-bleed highway hero background — cross-fades day/night photos with the sky cycle.
 * Falls back to HeroMountainScene when images fail to load.
 */
export default function HeroHighwayScene({ onPhotoError }) {
  const [failed, setFailed] = useState(false);

  const handleError = useCallback(() => {
    setFailed(true);
    onPhotoError?.();
  }, [onPhotoError]);

  if (failed) return null;

  return (
    <div className="hero-highway-scene" aria-hidden="true">
      <img
        className="hero-highway-photo hero-highway-photo--day"
        src={HERO_DAY_PHOTO}
        alt=""
        decoding="async"
        fetchPriority="high"
        onError={handleError}
      />
      <img
        className="hero-highway-photo hero-highway-photo--night"
        src={HERO_NIGHT_PHOTO}
        alt=""
        decoding="async"
        fetchPriority="high"
        onError={handleError}
      />
      <div className="hero-highway-scrim" aria-hidden="true" />
    </div>
  );
}

export { HERO_DAY_PHOTO, HERO_NIGHT_PHOTO };
