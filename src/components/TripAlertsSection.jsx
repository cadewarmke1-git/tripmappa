export default function TripAlertsSection({ alerts = [], onDismiss }) {
  if (!alerts.length) return null;

  return (
    <div className="trip-alerts-section">
      <div className="trip-alerts-title">Trip alerts</div>
      {alerts.map(alert => (
        <div key={alert.id} className={`trip-alert-card trip-alert-${alert.type}`}>
          <span className="trip-alert-icon" aria-hidden="true">!</span>
          <div className="trip-alert-body">
            <div className="trip-alert-heading">{alert.title}</div>
            <div className="trip-alert-msg">{alert.message}</div>
          </div>
          <button type="button" className="trip-alert-dismiss" onClick={() => onDismiss?.(alert.id)} aria-label="Dismiss">×</button>
        </div>
      ))}
    </div>
  );
}
