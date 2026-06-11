import { parseRating } from "../../lib/ratings.js";

/** Proportional gold star fill inline with numeric rating. */
export default function InlineStarRating({ rating, className = "" }) {
  const value = parseRating(rating);
  if (value == null) return null;

  const fillPercent = Math.min(100, Math.max(0, (value / 5) * 100));

  return (
    <span className={`inline-star-rating${className ? ` ${className}` : ""}`} aria-label={`${value} out of 5 stars`}>
      <span className="inline-star-icon-wrap" aria-hidden="true">
        <svg className="inline-star-icon inline-star-outline" viewBox="0 0 16 16">
          <path
            d="M8 1.8 9.9 6h4.2l-3.4 2.5 1.3 4.1L8 11.2 3.9 12.6l1.3-4.1L1.9 6h4.2L8 1.8z"
            fill="none"
            stroke="#FFD28C"
            strokeWidth="1.1"
          />
        </svg>
        <span className="inline-star-fill" style={{ width: `${fillPercent}%` }}>
          <svg className="inline-star-icon inline-star-filled" viewBox="0 0 16 16">
            <path
              d="M8 1.8 9.9 6h4.2l-3.4 2.5 1.3 4.1L8 11.2 3.9 12.6l1.3-4.1L1.9 6h4.2L8 1.8z"
              fill="#FFD28C"
            />
          </svg>
        </span>
      </span>
      <span className="inline-star-value">{value}</span>
    </span>
  );
}
