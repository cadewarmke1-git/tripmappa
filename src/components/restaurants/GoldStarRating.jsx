export default function GoldStarRating({ rating, max = 5 }) {
  const filled = Math.round(rating ?? 0);
  return (
    <div className="restaurant-stars" aria-label={rating != null ? `${rating} out of 5 stars` : "No rating"}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`restaurant-star${i < filled ? " filled" : ""}`} aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none">
            <path
              d="M8 1.8 9.9 6h4.2l-3.4 2.5 1.3 4.1L8 11.2 3.9 12.6l1.3-4.1L1.9 6h4.2L8 1.8z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      ))}
      {rating != null && <span className="restaurant-star-val">{rating.toFixed(1)}</span>}
    </div>
  );
}
