export default function LodgingCardSkeleton() {
  return (
    <div className="lodging-card lodging-card-skeleton" aria-hidden="true">
      <div className="lodging-card-photo skeleton-shimmer" />
      <div className="lodging-card-body">
        <div className="skeleton-line skeleton-shimmer skeleton-title" />
        <div className="skeleton-line skeleton-shimmer skeleton-stars" />
        <div className="skeleton-line skeleton-shimmer skeleton-short" />
        <div className="skeleton-line skeleton-shimmer skeleton-price" />
        <div className="skeleton-amenities">
          <div className="skeleton-pill skeleton-shimmer" />
          <div className="skeleton-pill skeleton-shimmer" />
          <div className="skeleton-pill skeleton-shimmer" />
        </div>
        <div className="skeleton-line skeleton-shimmer skeleton-desc" />
        <div className="skeleton-actions">
          <div className="skeleton-btn skeleton-shimmer" />
          <div className="skeleton-btn skeleton-shimmer skeleton-btn-secondary" />
        </div>
      </div>
    </div>
  );
}
