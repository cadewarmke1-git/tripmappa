import { copyText, googleMapsUrl, stopAddressLabel } from "../../lib/stopLocation.js";

export default function StopLocationActions({ stop, onToast, compact = false }) {
  const address = stopAddressLabel(stop);
  const mapsUrl = googleMapsUrl(stop);

  if (!address && !mapsUrl) return null;

  async function handleCopy(e) {
    e.stopPropagation();
    if (!address) return;
    try {
      await copyText(address);
      onToast?.("Address copied");
    } catch {
      onToast?.("Could not copy address");
    }
  }

  function handleMaps(e) {
    e.stopPropagation();
    if (!mapsUrl) return;
    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className={`stop-location-actions${compact ? " stop-location-actions-compact" : ""}`}>
      {address && (
        <button type="button" className="stop-location-btn" onClick={handleCopy}>
          Copy address
        </button>
      )}
      {mapsUrl && (
        <button type="button" className="stop-location-btn stop-location-btn-maps" onClick={handleMaps}>
          Open in Maps
        </button>
      )}
    </div>
  );
}
