const ICONS = {
  Car: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 17h14M7 17l-1.5-5.5a2 2 0 012-1.5h9a2 2 0 012 1.5L19 17M7 17a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0M20 17a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0M9 10h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Motorcycle: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="6.5" cy="17.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />
      <path d="M9 17.5h5M12 6l2 4M14 10l3 2M6 17.5l2.5-6.5 3-1.5 2.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  "SUV or Van": (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 17h16M6 17l-1-6a2 2 0 012-1.5h10A2 2 0 0119 11l1 6M6 17a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0M21 17a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0M8 11h8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  "Rental Car": (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 17h14M7 17l-1.5-5.5a2 2 0 012-1.5h9a2 2 0 012 1.5L19 17M7 17a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0M20 17a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0M9 10h6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 6v4" strokeLinecap="round" />
    </svg>
  ),
  RV: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 17h16M6 17l-1-7a2 2 0 012-1.5h10A2 2 0 0119 10l1 7M6 17a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0M21 17a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0M8 9h8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  "Camper Van": (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 17h14M7 17l-1-6a2 2 0 012-1.5h8A2 2 0 0118 11l1 6M7 17a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0M20 17a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0M10 8h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  truck: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 17h1M20 17h1M6 17a2 2 0 104 0 2 2 0 00-4 0M18 17a2 2 0 104 0 2 2 0 00-4 0M4 14h11v3H4v-3zM15 14h3l2 3v1h-5v-4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  default: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M8 12h8" strokeLinecap="round" />
    </svg>
  ),
};

export default function PlanVehicleIcon({ vehicle }) {
  if (ICONS[vehicle]) return ICONS[vehicle];
  if (/truck|semi|flatbed|tanker|box/i.test(String(vehicle))) return ICONS.truck;
  return ICONS.default;
}
