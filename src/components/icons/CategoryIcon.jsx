const TYPES = {
  fuel: "fuel",
  food: "food",
  rest: "rest",
  discovery: "discovery",
  stay: "stay",
  activity: "activity",
  default: "default",
};

function normalizeCategory(category) {
  const key = String(category || "").toLowerCase();
  if (/fuel|gas|ev|diesel|propane/.test(key)) return TYPES.fuel;
  if (/food|dining|meal|cafe|restaurant|bakery/.test(key)) return TYPES.food;
  if (/rest|scenic|park/.test(key)) return TYPES.rest;
  if (/discovery|attraction|poi/.test(key)) return TYPES.discovery;
  if (/stay|lodging|hotel|overnight/.test(key)) return TYPES.stay;
  if (/activity|playground|entertainment/.test(key)) return TYPES.activity;
  return TYPES.default;
}

const ICONS = {
  fuel: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 20V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M6 10h8M14 12h2l2 3v5h-4v-8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    </svg>
  ),
  food: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 4v8a3 3 0 0 0 6 0V4M10 12v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M16 4v16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  rest: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 16h16M6 16l2-8h8l2 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 20h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  discovery: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l2.2 6.8H21l-5.5 4 2.1 6.7L12 16.4 6.4 20.5l2.1-6.7L3 9.8h6.8L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    </svg>
  ),
  stay: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 10l8-5 8 5v10H4V10z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M10 20v-6h4v6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" stroke="currentColor" strokeWidth="1.6"/>
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.6"/>
    </svg>
  ),
  default: (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" stroke="currentColor" strokeWidth="1.6"/>
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.6"/>
    </svg>
  ),
};

export default function CategoryIcon({ category, className = "" }) {
  const type = normalizeCategory(category);
  return <span className={`tm-icon tm-icon-category tm-icon-${type} ${className}`.trim()}>{ICONS[type]}</span>;
}
