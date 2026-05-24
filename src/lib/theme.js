export function computeAutoTheme() {
  if (typeof window === "undefined") return "day";
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const sunset = 18 * 60 + 30; // 6:30 PM
  const sunrise = 6 * 60 + 30;  // 6:30 AM
  const isNightHours = mins >= sunset || mins < sunrise;
  if (prefersDark || isNightHours) return "night";
  return "day";
}