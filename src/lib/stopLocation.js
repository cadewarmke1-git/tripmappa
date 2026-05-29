/** Copy address and open Google Maps for itinerary stops. */

export function stopAddressLabel(stop) {
  if (!stop) return null;
  const parts = [
    stop.address || stop.formattedAddress,
    stop.location,
    stop.title || stop.name,
    stop.city,
  ].filter(Boolean);
  if (!parts.length && stop.lat != null && stop.lng != null) {
    return `${stop.lat}, ${stop.lng}`;
  }
  return parts[0] || null;
}

export function googleMapsUrl(stop) {
  if (!stop) return null;
  const label = encodeURIComponent(stopAddressLabel(stop) || "Destination");
  if (stop.lat != null && stop.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}`;
  }
  if (stopAddressLabel(stop)) {
    return `https://www.google.com/maps/search/?api=1&query=${label}`;
  }
  return null;
}

export function copyText(text) {
  if (!text) return Promise.reject(new Error("Nothing to copy"));
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "absolute";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}
