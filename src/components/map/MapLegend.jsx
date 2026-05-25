import { getLegendItems } from "../../lib/mapMarkers.js";

export default function MapLegend({ open, onToggle, isDarkMode }) {
  const items = getLegendItems().filter(i =>
    ["hotel", "fuel", "medical", "vet", "playground", "entertainment", "wifi", "religious", "safety", "budget", "alert", "custom"].includes(i.id),
  );

  return (
    <div className={`map-legend-wrap${isDarkMode ? " dark" : ""}`}>
      <button type="button" className="map-legend-toggle" onClick={onToggle} aria-expanded={open}>
        {open ? "Hide legend" : "Legend"}
      </button>
      {open && (
        <div className="map-legend-panel">
          {items.map(item => (
            <div key={item.id} className="map-legend-row">
              <span className="map-legend-swatch" style={{ background: item.color }}>{item.glyph}</span>
              <span className="map-legend-label">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
