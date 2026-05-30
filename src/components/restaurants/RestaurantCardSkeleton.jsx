import RouteDrawingLoader from "../RouteDrawingLoader.jsx";

export default function RestaurantCardSkeleton({ theme = "night" }) {
  return (
    <article className="restaurant-card-loader" aria-hidden="true">
      <RouteDrawingLoader theme={theme} variant="compact" />
    </article>
  );
}
