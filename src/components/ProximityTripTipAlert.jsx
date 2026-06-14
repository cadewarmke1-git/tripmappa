/** Proximity-based trip tip alerts during in-app navigation. */
import { useEffect, useMemo, useState } from "react";
import WeatherIcon from "./icons/WeatherIcon.jsx";
import AlertIcon from "./icons/AlertIcon.jsx";
import {
  buildProximityTips,
  findProximityTip,
  PROXIMITY_ALERT_RADIUS_MILES,
} from "../lib/proximityTripTips.js";

function AlertTypeIcon({ type }) {
  if (type === "weather") {
    return <WeatherIcon type="storm" className="proximity-tip-alert-icon" />;
  }
  if (type === "construction") {
    return <AlertIcon className="proximity-tip-alert-icon" />;
  }
  return <AlertIcon className="proximity-tip-alert-icon proximity-tip-alert-icon--traffic" />;
}

export default function ProximityTripTipAlert({
  active = false,
  tripTips = [],
  liveTripTips = [],
  tripAlerts = [],
  weatherByCity = {},
  routePoints = [],
  destination = "",
}) {
  const [userLocation, setUserLocation] = useState(null);
  const [activeTip, setActiveTip] = useState(null);
  const [gpsWatching, setGpsWatching] = useState(false);
  const [handledIds, setHandledIds] = useState(() => new Set());

  const proximityTips = useMemo(
    () => buildProximityTips({ tripTips, liveTripTips, tripAlerts, weatherByCity, routePoints }),
    [tripTips, liveTripTips, tripAlerts, weatherByCity, routePoints],
  );

  useEffect(() => {
    if (!active) {
      setUserLocation(null);
      setActiveTip(null);
      setGpsWatching(false);
      return undefined;
    }
    if (!navigator.geolocation) return undefined;

    setGpsWatching(true);
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      setGpsWatching(false);
    };
  }, [active]);

  useEffect(() => {
    if (!active || !userLocation) return;
    const match = findProximityTip(userLocation, proximityTips, handledIds, PROXIMITY_ALERT_RADIUS_MILES);
    if (!match) return;
    setActiveTip(match);
    setHandledIds((prev) => {
      if (prev.has(match.id)) return prev;
      const next = new Set(prev);
      next.add(match.id);
      return next;
    });
  }, [active, userLocation, proximityTips, handledIds]);

  function dismiss() {
    setActiveTip(null);
  }

  function reroute() {
    const dest = encodeURIComponent(destination || "");
    const origin = userLocation
      ? `${userLocation.lat},${userLocation.lng}`
      : "";
    const params = new URLSearchParams({ api: "1", travelmode: "driving" });
    if (origin) params.set("origin", origin);
    if (dest) params.set("destination", dest);
    window.open(`https://www.google.com/maps/dir/?${params}`, "_blank", "noopener,noreferrer");
  }

  if (!active) return null;

  return (
    <>
      {gpsWatching && <div data-gps-active="true" hidden aria-hidden="true" />}
      {activeTip && (
        <div className="proximity-tip-alert" role="alert" aria-live="polite">
          <AlertTypeIcon type={activeTip.type} />
          <div className="proximity-tip-alert-body">
            <div className="proximity-tip-alert-title">{activeTip.title}</div>
            {activeTip.text && activeTip.text !== activeTip.title && (
              <p className="proximity-tip-alert-text">{activeTip.text}</p>
            )}
          </div>
          <div className="proximity-tip-alert-actions">
            <button type="button" className="proximity-tip-alert-reroute" onClick={reroute}>
              Reroute
            </button>
            <button
              type="button"
              className="proximity-tip-alert-dismiss"
              onClick={dismiss}
              aria-label="Dismiss alert"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}
