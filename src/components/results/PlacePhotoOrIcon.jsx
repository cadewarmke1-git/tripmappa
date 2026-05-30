import { useState } from "react";
import CategoryIcon from "../icons/CategoryIcon.jsx";

export default function PlacePhotoOrIcon({ photoUrl, name, category, className = "", imgClassName = "" }) {
  const [failed, setFailed] = useState(false);

  if (photoUrl && !failed) {
    return (
      <img
        src={photoUrl}
        alt=""
        className={imgClassName}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className={`place-photo-fallback ${className}`} aria-hidden="true">
      <CategoryIcon category={category} className="place-photo-fallback-icon" />
      <span className="place-photo-fallback-name">{name}</span>
    </div>
  );
}
