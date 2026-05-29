/** Prominent weather warning banner for severe conditions along the route. */
import AlertIcon from "./icons/AlertIcon.jsx";

export default function WeatherWarningBanner({ alerts = [] }) {
  const weatherAlerts = alerts.filter(a => a.type === "weather");
  if (!weatherAlerts.length) return null;

  return (
    <div className="weather-warning-banner" role="alert">
      <AlertIcon className="weather-warning-icon" />
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
