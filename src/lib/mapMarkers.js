/** Map marker categories, colors, and legend labels. */

export const MARKER_CATEGORIES = {
  hotel: { label: "Overnight stop", color: "#FFD28C", glyph: "H", zIndex: 10 },
  fuel: { label: "Fuel stop", color: "#FFD28C", glyph: "F", zIndex: 9 },
  restaurant: { label: "Restaurant", color: "#E8A87C", glyph: "R", zIndex: 8 },
  park: { label: "National park", color: "#6BCB77", glyph: "P", zIndex: 7 },
  poi: { label: "Point of interest", color: "#FFD28C", glyph: "*", zIndex: 6 },
  medical: { label: "Medical", color: "#E85D5D", glyph: "+", zIndex: 5 },
  vet: { label: "Veterinary", color: "#E85D5D", glyph: "🐾", zIndex: 5 },
  playground: { label: "Park / playground", color: "#6BCB77", glyph: "⛳", zIndex: 6 },
  entertainment: { label: "Entertainment", color: "#C084FC", glyph: "♪", zIndex: 6 },
  wifi: { label: "WiFi stop", color: "#60A5FA", glyph: "WiFi", zIndex: 6 },
  religious: { label: "Prayer facility", color: "#94A3B8", glyph: "✝", zIndex: 5 },
  safety: { label: "Safety flagged", color: "#FFD28C", glyph: "🛡", zIndex: 8 },
  budget: { label: "Budget alert", color: "#F59E0B", glyph: "$", zIndex: 11 },
  alert: { label: "Trip alert", color: "#F59E0B", glyph: "!", zIndex: 12 },
  custom: { label: "Custom stop", color: "#FFFFFF", glyph: "C", zIndex: 13 },
  repair: { label: "Auto repair", color: "#94A3B8", glyph: "X", zIndex: 4 },
};

const ICON_PATHS = {
  medical: '<path d="M14 8v12M8 14h12" stroke="#1a1a2e" stroke-width="2.5" stroke-linecap="round"/>',
  vet: '<ellipse cx="16" cy="19" rx="5" ry="4" fill="#1a1a2e"/><circle cx="12" cy="12" r="2.5" fill="#1a1a2e"/><circle cx="20" cy="12" r="2.5" fill="#1a1a2e"/><circle cx="16" cy="9" r="2.5" fill="#1a1a2e"/>',
  playground: '<path d="M10 24V14l6-6 6 6v10M13 24v-6h6v6" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  entertainment: '<path d="M12 22V12M12 12c0-3 2-5 4-5s4 2 4 5M20 22V12M20 12c0-3 2-5 4-5" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="12" cy="9" r="2" fill="#1a1a2e"/><circle cx="20" cy="9" r="2" fill="#1a1a2e"/>',
  wifi: '<path d="M8 18c4-4 12-4 16 0M11 21c2.5-2.5 7.5-2.5 10 0M14 24h4" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="16" cy="24" r="1.5" fill="#1a1a2e"/>',
  religious: '<path d="M16 6v20M10 12h12M13 12V9a3 3 0 016 0v3" stroke="#1a1a2e" stroke-width="2" fill="none" stroke-linecap="round"/>',
  safety: '<path d="M16 5l9 4v7c0 6-4 10-9 12-5-2-9-6-9-12V9l9-4z" stroke="#1a1a2e" stroke-width="2" fill="none"/>',
  budget: '<text x="16" y="21" text-anchor="middle" font-size="16" font-weight="800" fill="#1a1a2e">$</text>',
  hotel: '<text x="16" y="21" text-anchor="middle" font-size="13" font-weight="700" fill="#1a1a2e">H</text>',
  fuel: '<text x="16" y="21" text-anchor="middle" font-size="13" font-weight="700" fill="#1a1a2e">F</text>',
  default: '<text x="16" y="21" text-anchor="middle" font-size="13" font-weight="700" fill="#1a1a2e">•</text>',
};

export function buildMarkerIcon(category, isDarkMode = false) {
  const cfg = MARKER_CATEGORIES[category] || MARKER_CATEGORIES.poi;
  const stroke = isDarkMode ? "#1a1a2e" : "#ffffff";
  const inner = ICON_PATHS[category] || ICON_PATHS.default;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="14" fill="${cfg.color}" stroke="${stroke}" stroke-width="2"/>
    ${inner}
  </svg>`;
  if (!window.google?.maps) return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}` };
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(32, 32),
    anchor: new window.google.maps.Point(16, 16),
  };
}

export function stopsToMapMarkers(stops = [], roadStops = [], customStops = [], extraMarkers = []) {
  const markers = [];

  stops.forEach((stop, i) => {
    if (stop.lat != null && stop.lng != null) {
      const safety = stop.safetyFlagged;
      markers.push({
        id: `stop-${i}`,
        lat: stop.lat,
        lng: stop.lng,
        category: safety ? "safety" : "hotel",
        title: stop.city || stop.name,
        subtitle: `${stop.distance || ""} · ${stop.eta || ""}`.trim(),
        stopIndex: i,
        action: "book",
        bookUrl: stop.bookUrl,
      });
    }
  });

  roadStops.forEach((rs, i) => {
    if (rs.lat != null && rs.lng != null) {
      markers.push({
        id: rs.id || `road-${i}`,
        lat: rs.lat,
        lng: rs.lng,
        category: rs.safetyFlagged ? "safety" : rs.category === "food" ? "restaurant" : rs.category === "fuel" || rs.category === "charging" ? "fuel" : rs.wifiAvailable ? "wifi" : "poi",
        title: rs.name,
        subtitle: rs.location || rs.distance,
        action: "add",
      });
    }
  });

  customStops.forEach(cs => {
    markers.push({ ...cs, category: cs.category || "custom", action: "directions" });
  });

  extraMarkers.forEach(a => markers.push(a));

  return markers;
}

export function getLegendItems() {
  return Object.entries(MARKER_CATEGORIES).map(([key, val]) => ({ id: key, ...val }));
}
