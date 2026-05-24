import { useState, useRef, useEffect, useCallback } from "react";

export default function HeroPhotoSlideshow({ photos, paused, active }) {
  const [currentIndex, setCurrentIndex] = useState(() => Math.floor(Math.random() * photos.length));
  const [incomingIndex, setIncomingIndex] = useState(null);
  const [incomingVisible, setIncomingVisible] = useState(false);
  const [instantHide, setInstantHide] = useState(false);
  const indexRef = useRef(currentIndex);
  const prevActiveRef = useRef(false);
  const isFirstMountRef = useRef(true);

  useEffect(() => {
    photos.forEach((url) => { new Image().src = url; });
  }, [photos]);

  const resetToFirst = useCallback(() => {
    indexRef.current = 0;
    setInstantHide(true);
    setCurrentIndex(0);
    setIncomingIndex(null);
    setIncomingVisible(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setInstantHide(false)));
  }, []);

  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      prevActiveRef.current = active;
      return;
    }
    if (active && !prevActiveRef.current) resetToFirst();
    prevActiveRef.current = active;
  }, [active, resetToFirst]);

  useEffect(() => {
    if (!active || paused || incomingIndex !== null) return;

    const timer = setTimeout(() => {
      setIncomingIndex((indexRef.current + 1) % photos.length);
    }, 5000);

    return () => clearTimeout(timer);
  }, [active, paused, currentIndex, incomingIndex, photos.length]);

  useEffect(() => {
    if (incomingIndex === null) return;

    const raf = requestAnimationFrame(() => setIncomingVisible(true));
    const done = setTimeout(() => {
      indexRef.current = incomingIndex;
      setInstantHide(true);
      setCurrentIndex(incomingIndex);
      setIncomingVisible(false);
      setIncomingIndex(null);
      requestAnimationFrame(() => requestAnimationFrame(() => setInstantHide(false)));
    }, 1500);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [incomingIndex]);

  return (
    <div className="hero-slideshow" aria-hidden="true">
      <div
        className="hero-bg-slide hero-bg-bottom"
        style={{ backgroundImage: `url(${photos[currentIndex]})` }}
      />
      <div
        className={`hero-bg-slide hero-bg-top${instantHide ? " no-transition" : ""}`}
        style={{
          backgroundImage: `url(${photos[incomingIndex ?? currentIndex]})`,
          opacity: incomingVisible ? 1 : 0,
        }}
      />
    </div>
  );
}