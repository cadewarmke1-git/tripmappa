import InlineStarRating from "./InlineStarRating.jsx";
import { parseRating } from "../../lib/ratings.js";

export default function PlaceRatingLine({ rating, className = "", emptyClassName = "place-no-reviews" }) {
  const parsed = parseRating(rating);
  if (parsed == null) {
    return <span className={emptyClassName}>No reviews yet</span>;
  }
  return <InlineStarRating rating={parsed} className={className} />;
}
