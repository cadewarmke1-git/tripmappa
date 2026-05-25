import AmenityBadges from "./AmenityBadges.jsx";

export default function RvParkCard({ park, onSave, onToast }) {
  function handleReserve() {
    window.open(park.reserveUrl, "_blank", "noopener,noreferrer");
  }

  function handleSave() {
    onSave?.(park);
    onToast?.(`Saved ${park.name}`);
  }

  return (
    <article className="lodging-card lodging-card-rv">
      <div className="lodging-card-photo-wrap">
        <img className="lodging-card-photo" src={park.photo} alt={park.name} loading="lazy" />
        <div className="lodging-card-photo-gradient" />
        <span className="lodging-type-badge">RV Park</span>
      </div>

      <div className="lodging-card-body">
        <h3 className="lodging-card-name">{park.name}</h3>
        <div className="lodging-card-price">{park.priceLabel}</div>

        <div className="lodging-detail-grid">
          <div className="lodging-detail-item">
            <span className="lodging-detail-label">Hookups</span>
            <span className="lodging-detail-value">{park.hookups}</span>
          </div>
          <div className="lodging-detail-item">
            <span className="lodging-detail-label">Dump station</span>
            <span className="lodging-detail-value">{park.dumpStation ? "Yes" : "No"}</span>
          </div>
          <div className="lodging-detail-item">
            <span className="lodging-detail-label">Max length</span>
            <span className="lodging-detail-value">{park.maxLength}</span>
          </div>
        </div>

        <AmenityBadges amenityIds={park.amenities} />
        <p className="lodging-card-desc">{park.description}</p>
        <p className="lodging-card-distance">{park.distanceFromRoute} mi from route</p>

        <div className="lodging-card-actions">
          <button type="button" className="btn-generate lodging-btn-book" onClick={handleReserve}>
            Reserve Site
          </button>
          <button type="button" className="lodging-btn-save" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </article>
  );
}
