/** Shown when required client env vars are missing — avoids silent map/places failure. */
export default function ConfigWarningBanner({ missing = [] }) {
  if (!missing.length) return null;
  return (
    <div className="config-warning-banner" role="alert">
      <strong>Configuration needed:</strong>{" "}
      {missing.includes("maps") && "Google Maps key (VITE_GOOGLE_MAPS_KEY) is missing — routing, Places enrichment, and map markers will be limited."}
      {missing.includes("maps") && missing.includes("auth") && " "}
      {missing.includes("auth") && "Supabase auth vars are missing — sign-in and saved trips are disabled."}
    </div>
  );
}
