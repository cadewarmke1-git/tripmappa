export function TripTipsSection({ tips = [], updatedAt = null, refreshing = false }) {
  const visible = tips.filter(Boolean).slice(0, 5);
  if (!visible.length) return null;

  const updatedLabel = updatedAt
    ? formatUpdatedLabel(updatedAt, refreshing)
    : null;

  return (
    <section className="trip-tips-section" aria-label="Trip Tips">
      <div className="trip-tips-header">
        <h3 className="trip-tips-title">Trip Tips</h3>
        {updatedLabel && <span className="trip-tips-updated">{updatedLabel}</span>}
      </div>
      <ul className="trip-tips-list">
        {visible.map((tip, i) => (
          <li key={`${i}-${tip.slice(0, 24)}`} className="trip-tips-line">{tip}</li>
        ))}
      </ul>
    </section>
  );
}

function formatUpdatedLabel(updatedAt, refreshing) {
  if (refreshing) return "Updating…";
  const mins = Math.max(0, Math.round((Date.now() - updatedAt) / 60000));
  if (mins < 1) return "Updated just now";
  if (mins === 1) return "Updated 1 min ago";
  return `Updated ${mins} min ago`;
}

/** Back-compat wrapper — maps legacy alert objects to tip lines. */
export default function TripAlertsBanner({ alerts = [], tips, updatedAt, refreshing }) {
  const lines = tips ?? alerts.map(a => {
    if (typeof a === "string") return a;
    if (a.message && a.title && a.title !== a.message) return `${a.title}: ${a.message}`;
    return a.message || a.title;
  }).filter(Boolean);
  return <TripTipsSection tips={lines} updatedAt={updatedAt} refreshing={refreshing} />;
}
