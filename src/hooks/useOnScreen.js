import { useEffect, useRef, useState } from "react";

/** True once the element has entered (or neared) the viewport — disconnects after first hit. */
export function useOnScreen({ rootMargin = "120px", threshold = 0.01 } = {}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin, threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible, rootMargin, threshold]);

  return [ref, visible];
}
