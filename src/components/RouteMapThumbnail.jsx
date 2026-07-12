/** Mini route preview from saved trip route points — no external API. */
export default function RouteMapThumbnail({ routePoints = [], className = "" }) {
  const points = (routePoints || []).filter((p) => p?.lat != null && p?.lng != null);
  if (points.length < 2) {
    return (
      <div className={`route-map-thumbnail route-map-thumbnail--empty${className ? ` ${className}` : ""}`} aria-hidden="true">
        <span className="route-map-thumbnail-fallback">Route</span>
      </div>
    );
  }

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(maxLat - minLat, 0.01);
  const lngSpan = Math.max(maxLng - minLng, 0.01);
  const pad = 6;
  const w = 120;
  const h = 72;

  const toX = (lng) => pad + ((lng - minLng) / lngSpan) * (w - pad * 2);
  const toY = (lat) => h - pad - ((lat - minLat) / latSpan) * (h - pad * 2);
  const polyline = points.map((p) => `${toX(p.lng)},${toY(p.lat)}`).join(" ");
  const start = points[0];
  const end = points[points.length - 1];

  return (
    <svg
      className={`route-map-thumbnail${className ? ` ${className}` : ""}`}
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      aria-hidden="true"
      role="img"
    >
      <rect x="0" y="0" width={w} height={h} rx="8" className="route-map-thumbnail-bg" />
      <polyline points={polyline} className="route-map-thumbnail-line" fill="none" />
      <circle cx={toX(start.lng)} cy={toY(start.lat)} r="3" className="route-map-thumbnail-dot route-map-thumbnail-dot-start" />
      <circle cx={toX(end.lng)} cy={toY(end.lat)} r="3" className="route-map-thumbnail-dot route-map-thumbnail-dot-end" />
    </svg>
  );
}
