import { Autocomplete } from "@react-google-maps/api";
import { configurePlacesAutocomplete } from "../../lib/places.js";
import RouteDrawingLoader from "../RouteDrawingLoader.jsx";

export default function NavigateRoutePanel({
  isLoaded,
  origin,
  dest,
  originRef,
  destRef,
  onOriginChange,
  onDestChange,
  onSwap,
  onGetRoute,
  routeLoading = false,
  theme = "night",
}) {
  return (
    <search className={`navigate-route-panel navigate-route-panel--${theme}`} aria-label="Route directions">
      <div className="navigate-route-grid">
        <div className="navigate-route-cell">
          <label className="navigate-route-label" htmlFor="navigate-origin">From</label>
          <div className="navigate-route-input-box">
            {isLoaded ? (
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

        <button
          type="button"
          className="navigate-route-swap"
          onClick={onSwap}
          aria-label="Swap origin and destination"
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2.5v11M5.5 5l2.5-2.5L10.5 5M5.5 11l2.5 2.5L10.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="navigate-route-cell">
          <label className="navigate-route-label" htmlFor="navigate-dest">To</label>
          <div className="navigate-route-input-box">
            {isLoaded ? (
              <Autocomplete
                onLoad={ac => configurePlacesAutocomplete(ac)}
                onPlaceChanged={() => {
                  if (destRef.current) onDestChange?.(destRef.current.value);
                }}
                options={{ types: ["geocode", "establishment"] }}
              >
                <input
                  id="navigate-dest"
                  ref={destRef}
                  className="navigate-route-input"
                  placeholder="Destination"
                  defaultValue={dest}
                  onChange={e => onDestChange?.(e.target.value)}
                  autoComplete="off"
                  aria-label="Route destination"
                />
              </Autocomplete>
            ) : (
              <input
                id="navigate-dest"
                ref={destRef}
                className="navigate-route-input"
                placeholder="Destination"
                value={dest}
                onChange={e => onDestChange?.(e.target.value)}
                autoComplete="off"
                aria-label="Route destination"
              />
            )}
          </div>
        </div>

        <button
          type="button"
          className="btn-generate navigate-route-go"
          onClick={onGetRoute}
          disabled={routeLoading}
        >
          {routeLoading ? <RouteDrawingLoader variant="button" /> : "Get route"}
        </button>
      </div>
    </search>
  );
}
