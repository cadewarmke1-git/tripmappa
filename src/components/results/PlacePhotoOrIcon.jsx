import { useState } from "react";
import CategoryIcon from "../icons/CategoryIcon.jsx";
import { resolvePlacePhotoUrl } from "../../lib/placePhotos.js";
import {
  resolveBrandPhotoFallback,
  resolveCategoryPhotoFallback,
} from "../../lib/brandPhotoFallbacks.js";
import { useOnScreen } from "../../hooks/useOnScreen.js";

export default function PlacePhotoOrIcon({
  photoUrl,
  name,
  category,
  className = "",
  imgClassName = "",
  displayPx = 64,
  preferFallback = false,
}) {
  const [failed, setFailed] = useState(false);
  const [ref, visible] = useOnScreen();
  const placePhoto = visible && !preferFallback ? resolvePlacePhotoUrl(photoUrl, displayPx) : null;
  const brandPhoto = resolveBrandPhotoFallback(name);
  const categoryPhoto = !brandPhoto ? resolveCategoryPhotoFallback(category) : null;
  const src = placePhoto || brandPhoto || categoryPhoto;

  if (src && !failed) {
    return (
      <img
        ref={ref}
        src={src}
        alt=""
        className={imgClassName}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div ref={ref} className={`place-photo-fallback ${className}`} aria-hidden="true">
      <CategoryIcon category={category} className="place-photo-fallback-icon" />
      <span className="place-photo-fallback-name">{name}</span>
    </div>
  );
}
