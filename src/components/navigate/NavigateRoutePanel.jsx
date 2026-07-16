import { useEffect } from "react";
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
  /** When GPS is denied/unavailable — keep dest-only; optional Navigate Home. */
  locationDenied = false,
  onNavigateHome = null,
  homeAddress = "",
  navigateHomePending = false,
}) {
  const hasHome = Boolean(String(homeAddress || "").trim());
  const showNavigateHome = locationDenied && typeof onNavigateHome === "function" && hasHome;

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
      className={`navigate-route-panel navigate-route-panel--${theme}`}
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

      {locationDenied && (
        <p className="navigate-route-location-hint" role="status">
          {hasHome
            ? "Location is off — routes start from your home address until you turn it on."
            : "Location is off — turn it on so we can start from where you are."}
          {showNavigateHome ? " Or head home in one tap." : ""}
        </p>
      )}

      <div className="navigate-route-grid navigate-route-grid--dest-only">
        <div className="navigate-route-dest-search">
          <SearchBarAnimated
            id="navigate-dest"
            inputRef={destRef}
            value={dest || ""}
            onChange={onDestChange}
            onSubmit={() => onGetRoute?.()}
            placeholder="Where to?"
            ariaLabel="Where to?"
            className="navigate-where-search"
            defaultExpanded={Boolean(dest) || locationDenied}
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
