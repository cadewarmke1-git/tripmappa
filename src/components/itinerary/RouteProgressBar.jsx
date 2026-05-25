export default function RouteProgressBar({ days = [], activeDayIndex, onDaySelect }) {
  if (!days.length) return null;

  return (
    <div className="route-progress-bar">
      <div className="route-progress-track">
        {days.map((day, i) => (
          <button
            key={day.dayNumber}
            type="button"
            className={`route-progress-stop${activeDayIndex === i ? " active" : ""}`}
            onClick={() => onDaySelect?.(i)}
            style={{ left: `${((i + 0.5) / days.length) * 100}%` }}
          >
            <span className="route-progress-dot"/>
            <span className="route-progress-label">{day.overnightCity ? day.overnightCity.split(",")[0] : day.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
