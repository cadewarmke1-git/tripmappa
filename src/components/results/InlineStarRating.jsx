import { parseRating } from "../../lib/ratings.js";

/** Single gold star inline with numeric rating for stop cards. */
export default function InlineStarRating({ rating, className = "" }) {
  const value = parseRating(rating);
  if (value == null) return null;

  return (
    <span className={`inline-star-rating${className ? ` ${className}` : ""}`} aria-label={`${value} out of 5 stars`}>
      <svg className="inline-star-icon" viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M8 1.8 9.9 6h4.2l-3.4 2.5 1.3 4.1L8 11.2 3.9 12.6l1.3-4.1L1.9 6h4.2L8 1.8z"
          fill="#FFD28C"
        />
      </svg>
      <span className="inline-star-value">{value}</span>
    </span>
  );
}
