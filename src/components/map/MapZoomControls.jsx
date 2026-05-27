/** Custom frosted zoom controls matching TripMappa map UI. */
export default function MapZoomControls({ mapRef }) {
  function zoomBy(delta) {
    const map = mapRef?.current;
    if (!map?.getZoom) return;
    const next = (map.getZoom() ?? 4) + delta;
    map.setZoom(Math.min(21, Math.max(2, next)));
  }

  return (
    <div className="map-zoom-controls" aria-label="Map zoom">
      <button type="button" className="map-zoom-btn" onClick={() => zoomBy(1)} aria-label="Zoom in">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
      <button type="button" className="map-zoom-btn" onClick={() => zoomBy(-1)} aria-label="Zoom out">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}
