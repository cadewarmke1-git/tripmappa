import PulsingWordmark from "../PulsingWordmark.jsx";

export default function RestaurantCardSkeleton({ theme = "night" }) {
  return (
    <article className="restaurant-card-loader" aria-hidden="true">
      <PulsingWordmark size="md" />
    </article>
  );
}
