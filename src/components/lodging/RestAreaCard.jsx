export default function RestAreaCard({ restArea, onSave, onToast, readOnly = false }) {
  function handleSave() {
    onSave?.(restArea);
    onToast?.(`Saved ${restArea.name}`);
  }

  const isOvernight = (restArea.stopType || "").toLowerCase().includes("overnight");

  return (
    <article className="lodging-card lodging-card-rest-area">
      <div className="lodging-card-photo-wrap lodging-card-photo-muted">
        <img
          className="lodging-card-photo"
          src={restArea.photo}
          alt={restArea.name}
          loading="lazy"
        />
        <div className="lodging-card-photo-gradient" />
        <span className="lodging-rest-area-badge">Free — No Reservation Needed</span>
      </div>

      <div className="lodging-card-body">
        <h3 className="lodging-card-name">{restArea.name}</h3>
        <p className="lodging-card-neighborhood">{restArea.highwayLocation}</p>

        <div className="lodging-detail-grid">
          <div className="lodging-detail-item">
            <span className="lodging-detail-label">Truck spaces</span>
            <span className="lodging-detail-value">{restArea.parkingSpaces}</span>
          </div>
          <div className="lodging-detail-item">
            <span className="lodging-detail-label">Stop type</span>
            <span className="lodging-detail-value">
              {isOvernight ? "Full overnight" : "Short break"}
            </span>
          </div>
        </div>

        <div className="lodging-rest-amenities">
          {(restArea.amenities || []).map(a => (
            <span key={a} className="lodging-amenity-badge lodging-amenity-badge-muted">
              {a}
            </span>
          ))}
        </div>

        <p className="lodging-card-desc">{restArea.note}</p>
        <p className="lodging-card-distance">{restArea.distanceFromRoute} mi from current position</p>

        <div className="lodging-card-actions">
          {!readOnly && (
            <button type="button" className="lodging-btn-save lodging-btn-save-full" onClick={handleSave}>
              Save
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
