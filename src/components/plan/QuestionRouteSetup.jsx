import { Autocomplete } from "@react-google-maps/api";
import { configurePlacesAutocomplete } from "../../lib/places.js";
import { formatSmartDefaultsSummary, VEHICLE_GROUPS } from "../../lib/tripFlow.js";

const ROUTE_SETUP_VEHICLES = VEHICLE_GROUPS
  .flatMap(g => g.options)
  .filter(o => o.value !== "Multi-Vehicle Trip")
  .slice(0, 8);

export default function QuestionRouteSetup({
  isLoaded,
  origin,
  dest,
  originRef,
  destRef,
  originAcRef,
  destAcRef,
  originError = "",
  destError = "",
  frozen = false,
  onOriginChange,
  onDestChange,
  onSwap,
  defaultsSummary = "",
  customizeActive = false,
  onCustomize,
  vehicle = "Car",
  onVehicleChange,
}) {
  const summary = defaultsSummary || formatSmartDefaultsSummary({ vehicle });

  return (
    <div className="plan-route-setup">
      <div className="plan-route-setup-grid">
        <div className="plan-route-setup-cell">
          <label className="plan-route-setup-label" htmlFor="plan-route-origin">From</label>
          <div className="plan-route-setup-input-box">
            {isLoaded ? (
              <Autocomplete
                onLoad={ac => {
                  if (originAcRef) originAcRef.current = ac;
                  configurePlacesAutocomplete(ac);
                }}
                onPlaceChanged={() => {
                  if (originRef?.current) onOriginChange?.(originRef.current.value);
                }}
                options={{ types: ["geocode", "establishment"] }}
              >
                <input
                  id="plan-route-origin"
                  ref={originRef}
                  className="plan-route-setup-input"
                  placeholder="Dallas, TX"
                  defaultValue={origin}
                  onChange={e => onOriginChange?.(e.target.value)}
                  disabled={frozen}
                  autoComplete="off"
                  aria-label="Trip origin"
                  aria-invalid={Boolean(originError)}
                />
              </Autocomplete>
            ) : (
              <input
                id="plan-route-origin"
                ref={originRef}
                className="plan-route-setup-input"
                placeholder="Dallas, TX"
                value={origin}
                onChange={e => onOriginChange?.(e.target.value)}
                disabled={frozen}
                autoComplete="off"
                aria-label="Trip origin"
                aria-invalid={Boolean(originError)}
              />
            )}
          </div>
          {originError && <p className="plan-route-setup-error" role="alert">{originError}</p>}
        </div>

        <button
          type="button"
          className="plan-route-setup-swap"
          onClick={onSwap}
          disabled={frozen}
          aria-label="Swap origin and destination"
        >
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2.5v11M5.5 5l2.5-2.5L10.5 5M5.5 11l2.5 2.5L10.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="plan-route-setup-cell">
          <label className="plan-route-setup-label" htmlFor="plan-route-dest">To</label>
          <div className="plan-route-setup-input-box">
            {isLoaded ? (
              <Autocomplete
                onLoad={ac => {
                  if (destAcRef) destAcRef.current = ac;
                  configurePlacesAutocomplete(ac);
                }}
                onPlaceChanged={() => {
                  if (destRef?.current) onDestChange?.(destRef.current.value);
                }}
                options={{ types: ["geocode", "establishment"] }}
              >
                <input
                  id="plan-route-dest"
                  ref={destRef}
                  className="plan-route-setup-input"
                  placeholder="Los Angeles, CA"
                  defaultValue={dest}
                  onChange={e => onDestChange?.(e.target.value)}
                  disabled={frozen}
                  autoComplete="off"
                  aria-label="Trip destination"
                  aria-invalid={Boolean(destError)}
                />
              </Autocomplete>
            ) : (
              <input
                id="plan-route-dest"
                ref={destRef}
                className="plan-route-setup-input"
                placeholder="Los Angeles, CA"
                value={dest}
                onChange={e => onDestChange?.(e.target.value)}
                disabled={frozen}
                autoComplete="off"
                aria-label="Trip destination"
                aria-invalid={Boolean(destError)}
              />
            )}
          </div>
          {destError && <p className="plan-route-setup-error" role="alert">{destError}</p>}
        </div>
      </div>

      <div className="plan-route-setup-vehicle">
        <label className="plan-route-setup-label" htmlFor="plan-route-vehicle">Vehicle</label>
        <select
          id="plan-route-vehicle"
          className="plan-route-setup-vehicle-select"
          value={vehicle || "Car"}
          disabled={frozen}
          onChange={(e) => onVehicleChange?.(e.target.value)}
        >
          {ROUTE_SETUP_VEHICLES.map(opt => (
            <option key={opt.value} value={opt.value}>
              {String(opt.label).split("—")[0].trim()}
            </option>
          ))}
        </select>
      </div>

      <div className="plan-route-setup-defaults" aria-live="polite">
        <p className="plan-route-setup-defaults-line">
          <span className="plan-route-setup-defaults-label">Defaults:</span>
          {" "}
          {summary}
          {customizeActive ? " · customizing" : ""}
        </p>
        {!customizeActive && (
          <button
            type="button"
            className="plan-route-setup-customize"
            disabled={frozen}
            onClick={onCustomize}
          >
            Customize
          </button>
        )}
      </div>
    </div>
  );
}
