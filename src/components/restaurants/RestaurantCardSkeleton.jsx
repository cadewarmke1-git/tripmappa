import GoldSpinner from "../GoldSpinner.jsx";

export default function RestaurantCardSkeleton({ theme = "night" }) {
  return (
    <article className="restaurant-card-loader" aria-hidden="true">
      <GoldSpinner size="md" />
    </article>
  );
}
