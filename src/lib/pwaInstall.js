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

export function subscribePwaInstall(callback) {
  listeners.add(callback);
  callback(Boolean(deferredPrompt));
  return () => listeners.delete(callback);
}

export async function promptPwaInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  try {
    await deferredPrompt.userChoice;
  } finally {
    deferredPrompt = null;
    notifyListeners();
  }
  return true;
}
