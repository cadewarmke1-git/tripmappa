import { useEffect, useState } from "react";
import { extractDestinationCity } from "../../lib/liveShareUtils.js";

export default function ArrivalCelebration({ destination, show, onDismiss }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (!show) return;
    const next = Array.from({ length: 48 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 0.8}s`,
      color: Math.random() > 0.5 ? "#FFD28C" : "#ffb347",
    }));
    setParticles(next);
  }, [show]);

  if (!show) return null;

  const city = extractDestinationCity(destination);

  return (
    <div className="arrival-celebration" role="status">
      <div className="arrival-confetti" aria-hidden="true">
        {particles.map(p => (
          <span
            key={p.id}
            className="arrival-confetti-piece"
            style={{ left: p.left, animationDelay: p.delay, background: p.color }}
          />
        ))}
      </div>
      <div className="arrival-banner">
        <h2 className="arrival-banner-title">Made it to {city}!</h2>
        <p className="arrival-banner-sub">Your convoy has arrived safely.</p>
        {onDismiss && (
          <button type="button" className="profile-btn profile-btn-gold" onClick={onDismiss}>
            Celebrate ✦
          </button>
        )}
      </div>
    </div>
  );
}

export function TripCompletePanel({ liveTrip }) {
  if (!liveTrip?.arrivedAt) return null;

  const started = liveTrip.tripStartedAt || liveTrip.createdAt;
  const durationMs = started
    ? new Date(liveTrip.arrivedAt).getTime() - new Date(started).getTime()
    : 0;
  const hours = Math.floor(durationMs / 3600000);
  const mins = Math.floor((durationMs % 3600000) / 60000);
  const durationLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  const miles = liveTrip.totalDistanceMiles ?? 0;

  return (
    <div className="trip-complete-panel">
      <div className="trip-complete-badge">Trip Complete</div>
      <h2 className="trip-complete-title">Journey finished</h2>
      <div className="trip-complete-stats">
        <div><span className="trip-complete-stat-val">{miles}</span><span className="trip-complete-stat-lbl">miles driven</span></div>
        <div><span className="trip-complete-stat-val">{durationLabel}</span><span className="trip-complete-stat-lbl">trip duration</span></div>
      </div>
    </div>
  );
}
