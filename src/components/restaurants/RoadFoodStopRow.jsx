import InlineStarRating from "../results/InlineStarRating.jsx";

export default function RoadFoodStopRow({ restaurant }) {
  if (!restaurant) return null;
  return (
    <div className="road-food-row">
      <span className="road-food-name">{restaurant.name}</span>
      <span className="road-food-sep">·</span>
      <span className="road-food-cuisine">{restaurant.cuisineType || "Food"}</span>
      {restaurant.rating != null && (
        <>
          <span className="road-food-sep">·</span>
          <InlineStarRating rating={restaurant.rating} className="road-food-rating" />
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
