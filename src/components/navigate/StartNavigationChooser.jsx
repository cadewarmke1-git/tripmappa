/**
 * Start Navigation chooser — TripMappa cockpit primary; Apple / Google / Waze secondary.
 * Truck vehicles get an explicit acknowledgment warning before any external handoff.
 */
import { useEffect, useMemo, useState } from "react";
import { useDialogA11y } from "../../hooks/useDialogA11y.js";
import {
  EXTERNAL_NAV_APPS,
  buildExternalNavUrl,
  detectNavApps,
  resolveDestinationCoords,
} from "../../lib/externalNavApps.js";
import { shouldUseTruckRouting } from "../../lib/truckRoutingApi.js";

export default function StartNavigationChooser({
  open = false,
  onClose,
  onStartInApp,
  answers = {},
  routeInfo = null,
  routePoints = null,
  truckRoutePath = null,
  destinationLabel = "",
}) {
  const [step, setStep] = useState("chooser"); // chooser | truck-warning
  const [pendingApp, setPendingApp] = useState(null);
  const [lastOpenedUrl, setLastOpenedUrl] = useState(null);
  const dialogRef = useDialogA11y(open, onClose, "start-nav-chooser-title");

  const isTruck = shouldUseTruckRouting(answers);
  // Require real HERE provider — truckSafe alone used to lie on Google fallbacks.
  const hasHereTruckRoute = routeInfo?.routeProvider === "here";
  const available = useMemo(() => detectNavApps(), []);
  const destCoords = useMemo(
    () => resolveDestinationCoords({ routeInfo, routePoints, truckRoutePath }),
    [routeInfo, routePoints, truckRoutePath],
  );

  const externalOptions = EXTERNAL_NAV_APPS.filter((app) => available[app.detectKey]);

  useEffect(() => {
    if (!open) {
      setStep("chooser");
      setPendingApp(null);
    }
  }, [open]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__TRIPMAPPA_NAV_CHOOSER__ = {
        open,
        step,
        isTruck,
        hasHereTruckRoute,
        pendingApp,
        lastOpenedUrl,
        destCoords,
        externalOptions: externalOptions.map((o) => o.id),
      };
    }
  }, [open, step, isTruck, hasHereTruckRoute, pendingApp, lastOpenedUrl, destCoords, externalOptions]);

  if (!open) return null;

  function launchExternal(appId) {
    const url = buildExternalNavUrl(appId, destCoords, destinationLabel || routeInfo?.destination || "");
    setLastOpenedUrl(url);
    if (typeof window !== "undefined") {
      window.__TRIPMAPPA_NAV_CHOOSER__ = {
        ...(window.__TRIPMAPPA_NAV_CHOOSER__ || {}),
        lastOpenedUrl: url,
        launchedApp: appId,
      };
    }
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    onClose?.();
  }

  function handleExternalPick(appId) {
    if (isTruck) {
      setPendingApp(appId);
      setStep("truck-warning");
      return;
    }
    launchExternal(appId);
  }

  function handleInApp() {
    onClose?.();
    onStartInApp?.();
  }

  const pendingLabel = EXTERNAL_NAV_APPS.find((a) => a.id === pendingApp)?.label || "Maps";

  return (
    <dialog
      ref={dialogRef}
      className="modal-overlay start-nav-chooser-overlay"
      aria-labelledby="start-nav-chooser-title"
      data-testid="start-nav-chooser"
      data-step={step}
      onClick={onClose}
    >
      <div
        className="modal start-nav-chooser-modal"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        {step === "chooser" ? (
          <>
            <h2 id="start-nav-chooser-title" className="start-nav-chooser-title">
              Start navigation
            </h2>
            <p className="start-nav-chooser-lead">
              Choose how you want to drive this route.
            </p>

            <button
              type="button"
              className="start-nav-chooser-primary"
              data-testid="start-nav-tripmappa"
              onClick={handleInApp}
            >
              <span className="start-nav-chooser-primary-label">Navigate in TripMappa</span>
              <span className="start-nav-chooser-primary-desc">
                Real turn-by-turn on your phone, plus trip tips and hazard alerts that Apple Maps,
                Google Maps, and Waze do not show.
              </span>
              {isTruck && hasHereTruckRoute && (
                <span className="start-nav-chooser-primary-note">
                  Continues on your HERE truck-safe route with height, weight, and hazmat limits.
                </span>
              )}
            </button>

            {externalOptions.length > 0 && (
              <div className="start-nav-chooser-external">
                <p className="start-nav-chooser-external-label">
                  For CarPlay or a dashboard display
                </p>
                <p className="start-nav-chooser-external-hint">
                  These apps can take over your car screen. They will not show TripMappa trip tips or hazard alerts.
                </p>
                <div className="start-nav-chooser-external-list">
                  {externalOptions.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      className="start-nav-chooser-external-btn"
                      data-testid={`start-nav-external-${app.id}`}
                      data-nav-app={app.id}
                      onClick={() => handleExternalPick(app.id)}
                      disabled={!destCoords}
                    >
                      <span className="start-nav-chooser-external-name">{app.label}</span>
                      <span className="start-nav-chooser-external-blurb">{app.blurb}</span>
                    </button>
                  ))}
                </div>
                {!destCoords && (
                  <p className="start-nav-chooser-error" role="status">
                    Destination coordinates are not ready yet — try again in a moment.
                  </p>
                )}
              </div>
            )}

            <button type="button" className="start-nav-chooser-cancel" onClick={onClose}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <h2 id="start-nav-chooser-title" className="start-nav-chooser-title">
              Truck routing warning
            </h2>
            <p className="start-nav-chooser-lead" data-testid="truck-nav-warning">
              {pendingLabel} does not apply truck-specific limits such as height, weight, and hazmat
              restrictions. The route it opens is a standard driving route and is not guaranteed safe
              for your vehicle.
            </p>
            {hasHereTruckRoute ? (
              <p className="start-nav-chooser-lead">
                Staying in TripMappa keeps you on the HERE truck route computed for this trip.
              </p>
            ) : (
              <p className="start-nav-chooser-lead">
                Navigate Only is blocked for trucks — it cannot build a truck-safe route. Plan a full
                trip in TripMappa when you need height, weight, and hazmat routing.
              </p>
            )}
            <div className="start-nav-chooser-warning-actions">
              <button
                type="button"
                className="start-nav-chooser-primary"
                data-testid="truck-nav-stay-in-app"
                onClick={handleInApp}
              >
                Stay in TripMappa
              </button>
              <button
                type="button"
                className="start-nav-chooser-danger"
                data-testid="truck-nav-acknowledge-external"
                onClick={() => launchExternal(pendingApp)}
              >
                I understand — open {pendingLabel}
              </button>
              <button
                type="button"
                className="start-nav-chooser-cancel"
                onClick={() => {
                  setStep("chooser");
                  setPendingApp(null);
                }}
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
