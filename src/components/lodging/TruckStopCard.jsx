import AmenityBadges from "./AmenityBadges.jsx";

export default function TruckStopCard({ stop, onSave, onToast, readOnly = false }) {
  const bookLabel = "View on map";

  function handleReserve() {
    if (!stop.reserveUrl) return;
    window.open(stop.reserveUrl, "_blank", "noopener,noreferrer");
  }

  function handleSave() {
    onSave?.(stop);
    onToast?.(`Saved ${stop.name}`);
  }

  return (
    <article className="lodging-card lodging-card-truck">
      <div className="lodging-card-photo-wrap">
        <img className="lodging-card-photo" src={stop.photo} alt={stop.name} loading="lazy" />
        <div className="lodging-card-photo-gradient" />
        <span className="lodging-type-badge">Truck Stop</span>
      </div>

      <div className="lodging-card-body">
        <h3 className="lodging-card-name">{stop.name}</h3>

        <div className="lodging-detail-grid">
          <div className="lodging-detail-item">
            <span className="lodging-detail-label">Parking</span>
            <span className="lodging-detail-value">{stop.parkingSpaces} spaces</span>
          </div>
          <div className="lodging-detail-item">
            <span className="lodging-detail-label">Showers</span>
            <span className="lodging-detail-value">{stop.showerCost}</span>
          </div>
          <div className="lodging-detail-item">
            <span className="lodging-detail-label">Laundry</span>
            <span className="lodging-detail-value">{stop.laundry ? "Available" : "—"}</span>
          </div>
          <div className="lodging-detail-item">
            <span className="lodging-detail-label">Diesel</span>
            <span className="lodging-detail-value lodging-card-price-inline">
              {stop.dieselPrice}
              <span className="data-estimated-label"> Estimated</span>
            </span>
          </div>
        </div>

        <p className="lodging-card-food">
          <span className="lodging-detail-label">Food on site</span>
          {stop.foodOptions}
        </p>

        <AmenityBadges amenityIds={stop.amenities} />
        <p className="lodging-card-desc">{stop.description}</p>
        <p className="lodging-card-distance">{stop.distanceFromRoute} mi from route</p>

        <div className="lodging-card-actions">
          {stop.reserveUrl && (
            <button type="button" className="btn-generate lodging-btn-book" onClick={handleReserve}>
              {bookLabel}
            </button>
          )}
          {!readOnly && (
            <button type="button" className="lodging-btn-save" onClick={handleSave}>
              Save
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
