const ICONS = {
  pet: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8" cy="9.5" r="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="7" r="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="9.5" r="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="10" cy="13" r="1.6" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="14" cy="13" r="1.6" stroke="currentColor" strokeWidth="1.6" />
      <ellipse cx="12" cy="17" rx="4.5" ry="3.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  family: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 20c0-3.5 2.7-6 6-6s6 2.5 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  dietary: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 4v7M11 4v4a2 2 0 1 1 4 0V4M15 4v7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 11v9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  preference: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 5.5 13.8 10l4.7.4-3.6 2.8 1.2 4.6L12 15.8 7.9 17.8l1.2-4.6-3.6-2.8 4.7-.4L12 5.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  ),
  default: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 7a7 7 0 0 1 11.7-2.3L20 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 17a7 7 0 0 1-11.7 2.3L4 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 4v3h-3M4 20v-3h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export default function PersonalTouchIcon({ type = "default", className = "" }) {
  const icon = ICONS[type] || ICONS.default;
  return (
    <span className={`planned-for-you-icon ${className}`.trim()} aria-hidden="true">
      {icon}
    </span>
  );
}
