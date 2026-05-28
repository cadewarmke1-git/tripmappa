import { formatStarLabel } from "../../lib/ratings.js";

export default function RoadFoodStopRow({ restaurant }) {
  if (!restaurant) return null;
  const ratingLabel = formatStarLabel(restaurant.rating);
  return (
    <div className="road-food-row">
      <span className="road-food-name">{restaurant.name}</span>
      <span className="road-food-sep">·</span>
      <span className="road-food-cuisine">{restaurant.cuisineType || "Food"}</span>
      {ratingLabel && (
        <>
          <span className="road-food-sep">·</span>
          <span className="road-food-rating">{ratingLabel}</span>
        </>
      )}
      {restaurant.distanceMiles != null && (
        <>
          <span className="road-food-sep">·</span>
          <span className="road-food-distance">{restaurant.distanceMiles} mi</span>
        </>
      )}
    </div>
  );
}
