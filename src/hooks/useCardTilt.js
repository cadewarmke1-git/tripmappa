import { useCallback, useEffect, useRef, useState } from "react";

const MAX_TILT_DEG = 10;
const HOVER_SCALE = "scale(1.02)";
const RESET_TRANSFORM = "perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)";

function readTiltSupport() {
  if (typeof window === "undefined") {
    return { canTilt: false, reducedMotion: false };
  }
  return {
    canTilt: window.matchMedia("(hover: hover)").matches,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

/** Desktop pointer tilt for cards — no-op on touch / reduced motion (scale-only). */
export function useCardTilt(externalRef) {
  const internalRef = useRef(null);
  const cardRef = externalRef || internalRef;
  const [style, setStyle] = useState(undefined);
  const [hovering, setHovering] = useState(false);
  const [tiltEnabled, setTiltEnabled] = useState(false);
  const supportRef = useRef(readTiltSupport());

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const hoverMq = window.matchMedia("(hover: hover)");
    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");

    function sync() {
      supportRef.current = {
        canTilt: hoverMq.matches,
        reducedMotion: motionMq.matches,
      };
      setTiltEnabled(hoverMq.matches);
    }

    sync();
    hoverMq.addEventListener("change", sync);
    motionMq.addEventListener("change", sync);
    return () => {
      hoverMq.removeEventListener("change", sync);
      motionMq.removeEventListener("change", sync);
    };
  }, []);

  const onPointerEnter = useCallback(() => {
    if (!supportRef.current.canTilt) return;
    setHovering(true);
    if (supportRef.current.reducedMotion) {
      setStyle({ transform: HOVER_SCALE });
    }
  }, []);

  const onPointerMove = useCallback((event) => {
    const { canTilt, reducedMotion } = supportRef.current;
    if (!canTilt || reducedMotion) return;

    const el = cardRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const rotateY = (x - 0.5) * (MAX_TILT_DEG * 2);
    const rotateX = (0.5 - y) * (MAX_TILT_DEG * 2);

    setStyle({
      transform: `perspective(600px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale(1.02)`,
    });
  }, [cardRef]);

  const onPointerLeave = useCallback(() => {
    if (!supportRef.current.canTilt) return;
    setHovering(false);
    setStyle({ transform: RESET_TRANSFORM });
  }, []);

  return {
    ref: cardRef,
    style,
    hovering,
    tiltEnabled,
    onPointerEnter,
    onPointerMove,
    onPointerLeave,
  };
}
