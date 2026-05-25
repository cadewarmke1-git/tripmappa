/** Safe star rating formatting — never show NaN. */
export function parseRating(rating) {
  if (rating == null || rating === "") return null;
  const n = typeof rating === "string" ? parseFloat(rating) : Number(rating);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 10) / 10;
}

export function formatStarLabel(rating) {
  const n = parseRating(rating);
  return n != null ? `${n}★` : null;
}

export function isLocalFavorite(rating) {
  const n = parseRating(rating);
  return n != null && n >= 4.5;
}
