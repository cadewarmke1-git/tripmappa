import { useState } from "react";
import CategoryIcon from "../icons/CategoryIcon.jsx";
import { resolvePlacePhotoUrl } from "../../lib/placePhotos.js";

export default function PlacePhotoOrIcon({
  photoUrl,
  name,
  category,
  className = "",
  imgClassName = "",
  displayPx = 64,
}) {
  const [failed, setFailed] = useState(false);
  const src = resolvePlacePhotoUrl(photoUrl, displayPx);

  if (src && !failed) {
    return (
      <img
        src={src}
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
