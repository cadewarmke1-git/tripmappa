/** Capture beforeinstallprompt for the profile menu Install App action. */

let deferredPrompt = null;
const listeners = new Set();

export function initPwaInstall() {
  if (typeof window === "undefined") return;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notifyListeners();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notifyListeners();
  });
}

function notifyListeners() {
  const available = Boolean(deferredPrompt);
  listeners.forEach((fn) => {
    try {
      fn(available);
    } catch {
      /* ignore subscriber errors */
    }
  });
}
