/** Non-blocking trip alert toasts — top-right stack for navigation (CarPlay-ready). */
import { useEffect, useRef, useState } from "react";

const TOAST_DURATION_MS = 8000;

function toastKey(alert) {
  if (!alert) return null;
  return alert.id || `${alert.type}-${alert.title}`;
}

export default function NavigationAlertToasts({
  fuelAdvisory = null,
  corridorAlert = null,
  onDismissFuel,
  onDismissCorridor,
  theme = "night",
}) {
  const [visible, setVisible] = useState([]);
  const timersRef = useRef(new Map());
  const seenRef = useRef(new Set());

  useEffect(() => {
    const incoming = [];
    if (fuelAdvisory) {
      incoming.push({
        id: `fuel-${fuelAdvisory.level}`,
        type: "fuel",
        level: fuelAdvisory.level,
        title: fuelAdvisory.level === "warn" ? "Range alert" : "Fuel range",
        text: fuelAdvisory.message,
        onDismiss: onDismissFuel,
      });
    }
    if (corridorAlert) {
      incoming.push({
        id: corridorAlert.id,
        type: corridorAlert.type || "alert",
        title: corridorAlert.title,
        text: corridorAlert.text !== corridorAlert.title ? corridorAlert.text : null,
        onDismiss: () => onDismissCorridor?.(corridorAlert.id),
      });
    }

    const effectTimers = [];

    for (const alert of incoming) {
      const key = toastKey(alert);
      if (!key || seenRef.current.has(key)) continue;
      seenRef.current.add(key);
      setVisible((prev) => [...prev, { ...alert, key, enteredAt: Date.now() }]);

      if (timersRef.current.has(key)) clearTimeout(timersRef.current.get(key));
      const timerId = setTimeout(() => {
        setVisible((prev) => prev.filter((t) => t.key !== key));
        timersRef.current.delete(key);
        alert.onDismiss?.();
      }, TOAST_DURATION_MS);
      timersRef.current.set(key, timerId);
      effectTimers.push({ key, timerId });
    }

    return () => {
      for (const { key, timerId } of effectTimers) {
        clearTimeout(timerId);
        if (timersRef.current.get(key) === timerId) {
          timersRef.current.delete(key);
        }
      }
    };
  }, [fuelAdvisory, corridorAlert, onDismissFuel, onDismissCorridor]);

  useEffect(() => () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current.clear();
  }, []);

  function dismissToast(item) {
    if (timersRef.current.has(item.key)) {
      clearTimeout(timersRef.current.get(item.key));
      timersRef.current.delete(item.key);
    }
    setVisible((prev) => prev.filter((t) => t.key !== item.key));
    item.onDismiss?.();
  }

  if (!visible.length) return null;

  return (
    <div className={`nav-alert-toasts nav-alert-toasts--${theme}`} aria-live="polite">
      {visible.map((item) => (
        <div
          key={item.key}
          className={`nav-alert-toast nav-alert-toast--${item.type}${item.level ? ` nav-alert-toast--${item.level}` : ""}`}
          role="status"
        >
          <div className="nav-alert-toast-body">
            <strong className="nav-alert-toast-title">{item.title}</strong>
            {item.text && <p className="nav-alert-toast-text">{item.text}</p>}
          </div>
          <button
            type="button"
            className="nav-alert-toast-dismiss"
            onClick={() => dismissToast(item)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
