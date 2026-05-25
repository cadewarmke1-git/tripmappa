import { useState } from "react";

export default function TripAlertsBanner({ alerts = [], onDismiss }) {
  const [open, setOpen] = useState(false);
  if (!alerts.length) return null;

  return (
    <div className={`trip-alerts-banner${open ? " open" : ""}`}>
      <button type="button" className="trip-alerts-banner-toggle" onClick={() => setOpen(o => !o)}>
        <span className="trip-alerts-banner-count">{alerts.length}</span>
        <span>{alerts.length === 1 ? "1 trip note" : `${alerts.length} trip notes`}</span>
        <span className="trip-alerts-banner-chevron">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="trip-alerts-banner-panel">
          {alerts.map(alert => (
            <div key={alert.id} className={`trip-alert-row trip-alert-${alert.type}`}>
              <div className="trip-alert-row-text">
                <strong>{alert.title}</strong>
                <span>{alert.message}</span>
              </div>
              <button type="button" className="trip-alert-row-dismiss" onClick={() => onDismiss?.(alert.id)} aria-label="Dismiss">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
