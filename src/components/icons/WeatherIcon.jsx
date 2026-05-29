const ICONS = {
  clear: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  "partly-cloudy": (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M5 18h11a4 4 0 0 0 .5-8 5 5 0 0 0-9.6-1.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  cloudy: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 17h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6-1.1A3.5 3.5 0 0 0 6 17z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  rain: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 14h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6-1.1A3.5 3.5 0 0 0 6 14z" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M9 18v3M12 17v3M15 18v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  storm: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 13h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6-1.1A3.5 3.5 0 0 0 6 13z" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M11 16h2l-1.5 4h2L11 22" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  snow: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 14h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6-1.1A3.5 3.5 0 0 0 6 14z" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M8 18h.01M12 17h.01M16 18h.01M10 20h.01M14 20h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  fog: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 10h14M4 14h12M6 18h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  wind: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 8h11a3 3 0 1 0-3-3M4 16h13a3 3 0 1 1-3 3M6 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  default: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M12 4v2M12 18v2M6 12H4M20 12h-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
};

export default function WeatherIcon({ type = "default", className = "" }) {
  const icon = ICONS[type] || ICONS.default;
  return <span className={`tm-icon tm-icon-weather ${className}`.trim()}>{icon}</span>;
}
