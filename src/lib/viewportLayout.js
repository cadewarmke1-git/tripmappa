/** Breakpoint between mobile mockup and desktop web layout (CSS px). */
export const WEB_LAYOUT_MIN = 769;

export function resolveLayoutFromMatches({ wide = false, finePointer = false } = {}) {
  return wide || finePointer ? "web" : "mobile";
}

/**
 * Web = wide viewport OR desktop pointer (mouse/trackpad).
 * Mobile = touch-first narrow viewports only.
 * Fixes desktop browsers at ≤768 CSS px due to zoom/OS scaling still getting web layout.
 */
export function resolveLayoutMode() {
  if (typeof window === "undefined") return "web";
  const wide = window.matchMedia(`(min-width: ${WEB_LAYOUT_MIN}px)`).matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  return resolveLayoutFromMatches({ wide, finePointer });
}

export function syncViewportLayout() {
  document.documentElement.dataset.layout = resolveLayoutMode();
}

export function initViewportLayout() {
  syncViewportLayout();
  const wideMq = window.matchMedia(`(min-width: ${WEB_LAYOUT_MIN}px)`);
  const pointerMq = window.matchMedia("(hover: hover) and (pointer: fine)");
  const onChange = () => syncViewportLayout();
  wideMq.addEventListener("change", onChange);
  pointerMq.addEventListener("change", onChange);
  window.addEventListener("resize", onChange, { passive: true });
  return () => {
    wideMq.removeEventListener("change", onChange);
    pointerMq.removeEventListener("change", onChange);
    window.removeEventListener("resize", onChange);
  };
}
