/** Prominent weather warning banner for severe conditions along the route. */
export default function WeatherWarningBanner({ alerts = [] }) {
  const weatherAlerts = alerts.filter(a => a.type === "weather");
  if (!weatherAlerts.length) return null;

  return (
    <div className="weather-warning-banner" role="alert">
      <span className="weather-warning-icon" aria-hidden="true">⚠️</span>
      <div className="weather-warning-content">
        {weatherAlerts.map(alert => (
          <div key={alert.id} className="weather-warning-item">
            <strong>{alert.title}</strong>
            <span>{alert.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
