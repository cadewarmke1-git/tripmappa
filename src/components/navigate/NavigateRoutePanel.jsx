import { useEffect } from "react";
import { Autocomplete } from "@react-google-maps/api";
import { configurePlacesAutocomplete } from "../../lib/places.js";
import GoldSpinner from "../GoldSpinner.jsx";
import SearchBarAnimated from "../SearchBarAnimated.jsx";

export default function NavigateRoutePanel({
  isLoaded,
  dest,
  destRef,
  onDestChange,
  onGetRoute,
  onBack = null,
  routeLoading = false,
  theme = "night",
  /** When GPS is denied/unavailable, show manual From + Navigate Home. */
  locationDenied = false,
  origin = "",
  originRef = null,
  onOriginChange = null,
  onNavigateHome = null,
  homeAddress = "",
  navigateHomePending = false,
}) {
  const showManualOrigin = Boolean(locationDenied);
  const hasHome = Boolean(String(homeAddress || "").trim());
  const showNavigateHome = showManualOrigin && typeof onNavigateHome === "function" && hasHome;

  useEffect(() => {
    if (!isLoaded || !window.google?.maps?.places || !destRef?.current) return undefined;
    const ac = new window.google.maps.places.Autocomplete(destRef.current, {
      types: ["geocode", "establishment"],
    });
    configurePlacesAutocomplete(ac);
    const listener = ac.addListener("place_changed", () => {
      const next = destRef.current?.value || "";
      onDestChange?.(next);
    });
    return () => {
      window.google?.maps?.event?.removeListener?.(listener);
    };
  }, [isLoaded, destRef, onDestChange]);

  return (
    <search
      className={`navigate-route-panel navigate-route-panel--${theme}${showManualOrigin ? " navigate-route-panel--manual-origin" : ""}`}
      aria-label="Route directions"
    >
      {typeof onBack === "function" && (
        <div className="navigate-route-toolbar">
          <button type="button" className="navigate-route-back" onClick={onBack}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Home
          </button>
        </div>
      )}

      {showManualOrigin && (
        <p className="navigate-route-location-hint" role="status">
          Location is off — enter a start point below, or head home in one tap.
        </p>
      )}

      <div className={`navigate-route-grid${showManualOrigin ? "" : " navigate-route-grid--dest-only"}`}>
        {showManualOrigin && (
          <div className="navigate-route-cell navigate-route-cell--from">
            <label className="navigate-route-label" htmlFor="navigate-origin">From</label>
            <div className="navigate-route-input-box">
              {isLoaded && originRef ? (
                <Autocomplete
                  onLoad={ac => configurePlacesAutocomplete(ac)}
                  onPlaceChanged={() => {
                    if (originRef.current) onOriginChange?.(originRef.current.value);
                  }}
                  options={{ types: ["geocode", "establishment"] }}
                >
                  <input
                    id="navigate-origin"
                    ref={originRef}
                    className="navigate-route-input"
                    placeholder="Start location"
                    defaultValue={origin}
                    onChange={e => onOriginChange?.(e.target.value)}
                    autoComplete="off"
                    aria-label="Route start"
                  />
                </Autocomplete>
              ) : (
                <input
                  id="navigate-origin"
                  ref={originRef}
                  className="navigate-route-input"
                  placeholder="Start location"
                  value={origin}
                  onChange={e => onOriginChange?.(e.target.value)}
                  autoComplete="off"
                  aria-label="Route start"
                />
              )}
            </div>
          </div>
        )}

        <div className={`navigate-route-dest-search${showManualOrigin ? " navigate-route-dest-search--paired" : ""}`}>
          {showManualOrigin && (
            <label className="navigate-route-label" htmlFor="navigate-dest">To</label>
          )}
          <SearchBarAnimated
            id="navigate-dest"
            inputRef={destRef}
            value={dest || ""}
            onChange={onDestChange}
            onSubmit={() => onGetRoute?.()}
            placeholder="Where to?"
            ariaLabel="Where to?"
            className="navigate-where-search"
            defaultExpanded={Boolean(dest) || showManualOrigin}
          />
        </div>

        <button
          type="button"
          className="btn-generate navigate-route-go"
          onClick={onGetRoute}
          disabled={routeLoading}
        >
          {routeLoading ? <GoldSpinner size="button" /> : "Get route"}
        </button>
      </div>

      {showNavigateHome && (
        <div className="navigate-route-home-row">
          <button
            type="button"
            className="navigate-route-home-btn"
            onClick={onNavigateHome}
            disabled={navigateHomePending || routeLoading}
          >
            {navigateHomePending ? <GoldSpinner size="button" /> : "Navigate Home"}
          </button>
        </div>
      )}
    </search>
  );
}
