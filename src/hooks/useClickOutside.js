import { useEffect } from "react";

/** Calls handler when pointer down occurs outside ref element. */
export function useClickOutside(ref, handler, enabled = true) {
  useEffect(() => {
    if (!enabled || !handler) return undefined;

    function onPointerDown(event) {
      const root = ref.current;
      if (!root || root.contains(event.target)) return;
      handler(event);
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [ref, handler, enabled]);
}
