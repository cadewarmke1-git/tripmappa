const CATEGORY_ICONS = {
  Fuel: "⛽",
  Food: "🍽",
  Rest: "🛣",
  Dining: "🍽",
  Activity: "📍",
  Discovery: "✦",
  default: "📍",
};

export default function PlacePhotoOrIcon({ photoUrl, name, category, className = "", imgClassName = "" }) {
  if (photoUrl) {
    return <img src={photoUrl} alt="" className={imgClassName} loading="lazy"/>;
  }
  const icon = CATEGORY_ICONS[category] || CATEGORY_ICONS.default;
  return (
    <div className={`place-photo-fallback ${className}`} aria-hidden="true">
      <span className="place-photo-fallback-icon">{icon}</span>
      <span className="place-photo-fallback-name">{name}</span>
    </div>
  );
}
