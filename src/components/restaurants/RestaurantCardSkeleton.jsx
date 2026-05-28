export default function RestaurantCardSkeleton() {
  return (
    <article className="restaurant-card restaurant-card-skeleton" aria-hidden="true">
      <div className="restaurant-card-photo-wrap skeleton-shimmer" />
      <div className="restaurant-card-body">
        <div className="restaurant-skeleton-line skeleton-shimmer" />
        <div className="restaurant-skeleton-line short skeleton-shimmer" />
        <div className="restaurant-skeleton-line skeleton-shimmer" />
      </div>
    </article>
  );
}
