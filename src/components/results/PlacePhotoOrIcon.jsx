import CategoryIcon from "../icons/CategoryIcon.jsx";

export default function PlacePhotoOrIcon({ photoUrl, name, category, className = "", imgClassName = "" }) {
  if (photoUrl) {
    return <img src={photoUrl} alt="" className={imgClassName} loading="lazy"/>;
  }
  return (
    <div className={`place-photo-fallback ${className}`} aria-hidden="true">
      <CategoryIcon category={category} className="place-photo-fallback-icon" />
      <span className="place-photo-fallback-name">{name}</span>
    </div>
  );
}
