/** Grocery delivery helpers — destination address, scheduling, trip reference. */
import { parseHoursFromDuration } from "./parsing.js";

export function citiesMatch(a, b) {
  if (!a || !b) return false;
  const norm = (s) => s.split(",")[0].trim().toLowerCase();
  return norm(a) === norm(b);
}

export function parseAddressString(raw) {
  const text = String(raw || "").trim();
  if (!text) {
    return { line1: "", line2: "", city: "", state: "", postal: "" };
  }
  const parts = text.split(",").map(p => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const stateZip = parts[parts.length - 1].match(/^([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?$/);
    if (stateZip) {
      return {
        line1: parts.slice(0, -2).join(", ") || parts[0],
        line2: "",
        city: parts[parts.length - 2] || "",
        state: stateZip[1] || "",
        postal: stateZip[2] || "",
      };
    }
  }
  if (parts.length === 2) {
    const stateZip = parts[1].match(/^([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)?$/);
    if (stateZip) {
      return {
        line1: parts[0],
        line2: "",
        city: parts[0],
        state: stateZip[1] || "",
        postal: stateZip[2] || "",
      };
    }
  }
  return { line1: text, line2: "", city: parts[0] || text, state: "", postal: "" };
}

export function resolveGroceryDestination({ dest, selectedLodging = [], stops = [] }) {
  const destCity = dest || "";
  const destParts = parseAddressString(destCity);
  const destStop = [...(stops || [])].reverse().find(s => s.city && citiesMatch(s.city, destCity))
    || (stops || []).find(s => s.city && citiesMatch(s.city, destCity));

  const hotel = (selectedLodging || []).find(l => l.city && citiesMatch(l.city, destCity))
    || (selectedLodging || [])[(selectedLodging || []).length - 1]
    || (selectedLodging || [])[0]
    || null;

  const hotelLine = hotel?.name
    ? [hotel.name, hotel.neighborhood || hotel.address].filter(Boolean).join(", ")
    : null;

  const displayAddress = hotelLine || destCity || "Destination address unavailable";

  const instacartAddress = {
    address_line_1: hotel?.name || destParts.line1 || destCity,
    address_line_2: hotel?.neighborhood || hotel?.address || destParts.line2 || "",
    city: destParts.city || destCity.split(",")[0]?.trim() || "",
    state: destParts.state || "",
    postal_code: destParts.postal || "",
    country: "US",
  };

  return {
    displayAddress,
    hotelName: hotel?.name || null,
    instacartAddress,
    lat: destStop?.lat ?? hotel?.lat ?? null,
    lng: destStop?.lng ?? hotel?.lng ?? null,
  };
}

export function computeDestinationArrival({ departureTime, routeInfo }) {
  const dep = departureTime instanceof Date
    ? departureTime
    : (departureTime ? new Date(departureTime) : new Date());
  if (Number.isNaN(dep.getTime())) return new Date();
  const hours = parseHoursFromDuration(routeInfo?.duration) || 0;
  return new Date(dep.getTime() + hours * 3600000);
}

export function defaultScheduledDeliveryTime(arrivalDate) {
  const d = new Date(arrivalDate);
  d.setTime(d.getTime() - 60 * 60 * 1000);
  return d;
}

export function formatDatetimeLocalValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseDatetimeLocalValue(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDisplayDateTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function buildTripReferenceId({ origin, dest, departureTime }) {
  const raw = [origin || "", dest || "", departureTime?.toISOString?.() || ""].join("::");
  let h = 0;
  for (let i = 0; i < raw.length; i += 1) {
    h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
  }
  return `trip-${Math.abs(h).toString(36)}`;
}

export function splitSpokenGroceryItems(text) {
  return String(text || "")
    .split(/,|\band\b|\n|;/i)
    .map(s => s.replace(/^\s*(?:add|get|buy)\s+/i, "").trim())
    .filter(item => item.length > 1);
}

export function normalizeGroceryItemName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}
