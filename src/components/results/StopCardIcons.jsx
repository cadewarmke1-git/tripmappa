/** Inline icons for road-trip stop cards (lucide-compatible shapes, no extra dependency). */

export function MapPinIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function NavigationIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m3 11 18-8-8 18-2-7-8-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function BookOpenIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function GlobeIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function BedDoubleIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 20v-8a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M2 12h20M6 12V8a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const ACTION_ICON_MAP = {
  "Get directions": NavigationIcon,
  Navigate: NavigationIcon,
  Menu: BookOpenIcon,
  Website: GlobeIcon,
  "View listing": GlobeIcon,
  "Choose stay": BedDoubleIcon,
  "Add to route": NavigationIcon,
  "On your route": NavigationIcon,
};

export function StopCardActionIcon({ label, className = "" }) {
  const Icon = ACTION_ICON_MAP[label];
  if (!Icon) return null;
  return <Icon className={className} />;
}
