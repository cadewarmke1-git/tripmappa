export default function GoldStarRating({ rating, max = 5 }) {
  const filled = Math.round(rating ?? 0);
  return (
    <div className="restaurant-stars" aria-label={rating != null ? `${rating} out of 5 stars` : "No rating"}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`restaurant-star${i < filled ? " filled" : ""}`} aria-hidden="true">★</span>
      ))}
      {rating != null && <span className="restaurant-star-val">{rating.toFixed(1)}</span>}
    </div>
  );
}
