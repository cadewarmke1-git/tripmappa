/** Place photo URLs sized for crisp fixed thumbnails (2× display resolution). */

export const THUMB_MOBILE_PX = 56;
export const THUMB_DESKTOP_PX = 64;
export const HOTEL_PHOTO_HEIGHT_PX = 96;

function targetWidth(displayPx) {
  return Math.max(64, Math.round(displayPx * 2));
}

export function scalePlacesPhotoUrl(url, displayPx = THUMB_DESKTOP_PX) {
  if (!url || typeof url !== "string") return url;
  const w = targetWidth(displayPx);
  if (/maxwidth=\d+/i.test(url)) {
    return url.replace(/maxwidth=\d+/i, `maxwidth=${w}`);
  }
  if (/maxWidth[=:]\d+/i.test(url)) {
    return url.replace(/maxWidth[=:]\d+/i, (m) => m.replace(/\d+/, String(w)));
  }
  const sep = url.includes("?") ? "&" : "?";
  if (url.includes("unsplash.com")) {
    return url.replace(/w=\d+/i, `w=${w}`).includes("w=")
      ? url.replace(/w=\d+/i, `w=${w}`)
      : `${url}${sep}w=${w}&q=80`;
  }
  return url;
}

/** Resolve a Google Places photo URL for browser img tags (re-signs with client Maps key). */
export function resolvePlacePhotoUrl(url, displayPx = THUMB_DESKTOP_PX) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const clientKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  const refMatch = trimmed.match(/[?&]photo_reference=([^&]+)/i);
  if (refMatch && clientKey) {
    const w = targetWidth(displayPx);
    const ref = decodeURIComponent(refMatch[1]);
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${w}&photo_reference=${encodeURIComponent(ref)}&key=${clientKey}`;
  }

  return scalePlacesPhotoUrl(trimmed, displayPx);
}
