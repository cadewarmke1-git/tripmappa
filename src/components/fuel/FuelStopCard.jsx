function getBrandInitials(brand, type) {
  if (!brand) return type === "ev" ? "EV" : "FU";
  const known = {
    Tesla: "TS",
    ChargePoint: "CP",
    "Electrify America": "EA",
    EVgo: "EG",
    Shell: "SH",
    Chevron: "CV",
    BP: "BP",
    "Pilot Flying J": "PF",
    "Love's": "LV",
    "TA Travel Center": "TA",
    Petro: "PE",
    Exxon: "EX",
    Marathon: "MA",
    Speedway: "SP",
  };
  if (known[brand]) return known[brand];
  const words = brand.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return brand.slice(0, 2).toUpperCase();
}

export default function FuelStopCard({ stop, type, onAdd, required }) {
  const brand = stop.brand || stop.network || stop.name;
  const initials = getBrandInitials(brand, type);

  return (
    <article className={`fuel-stop-card${required ? " fuel-stop-required" : ""}`}>
      {required && (
        <div className="fuel-required-badge">Required stop</div>
      )}
      {stop.bestPrice && (
        <div className="fuel-best-price-badge">Best Price</div>
      )}
      <div className="fuel-stop-header">
        <div className="fuel-brand-logo" aria-hidden="true">{initials}</div>
        <div className="fuel-stop-title-wrap">
          <div className="fuel-stop-name">{stop.name}</div>
          <div className="fuel-stop-brand">{brand}</div>
        </div>
      </div>

      {type === "ev" && (
        <>
          <div className="fuel-type-badge fuel-type-ev">
            {(stop.chargerTypes || []).join(" · ") || "EV Charging"}
          </div>
          <div className="fuel-stop-price">
            {stop.chargeTime80 || "~30 min"} to 80%
          </div>
          {stop.ports != null && (
            <div className="fuel-stop-meta">{stop.ports} ports available</div>
          )}
        </>
      )}

      {type === "diesel" && (
        <>
          <div className="fuel-type-badge fuel-type-diesel">Diesel</div>
          <div className="fuel-stop-price">{stop.dieselPrice || "$3.95/gal"}</div>
          {stop.hasDef && <div className="fuel-stop-meta">DEF available</div>}
        </>
      )}

      {type === "gas" && (
        <>
          <div className="fuel-type-badge fuel-type-gas">Gas</div>
          <div className="fuel-stop-price">
            {stop.regularPrice || "$3.45/gal"}
            {stop.premiumPrice && (
              <span className="fuel-premium"> · Prem {stop.premiumPrice.replace("/gal", "")}</span>
            )}
          </div>
        </>
      )}

      {type === "propane" && (
        <>
          <div className="fuel-type-badge fuel-type-propane">Propane</div>
          <div className="fuel-stop-meta">RV refill location</div>
        </>
      )}

      <div className="fuel-stop-distance">{stop.distanceMiles?.toFixed(1) ?? "—"} mi from route</div>

      {!stop.estimated && stop.livePrices && type !== "ev" && (
        <div className="fuel-live-badge">Prices updated live</div>
      )}
      {stop.estimated && (
        <div className="fuel-estimate-note">Regional avg — updated weekly</div>
      )}

      <button type="button" className="btn-generate fuel-add-btn" onClick={() => onAdd(stop, type)}>
        Add to Trip
      </button>
    </article>
  );
}
