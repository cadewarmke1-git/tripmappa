/** Pre-Claude trip-segment context: weather, daylight, fuel — pure scoring + formatting. */

export const HEAT_F = 95;
export const COLD_F = 25;
export const HIGH_PRECIP_PCT = 60;
export const FUEL_SPREAD_MEANINGFUL = 0.15; // $/gal

const OUTDOOR_TYPE_RE = /park|campground|picnic|beach|trail|scenic|tourist_attraction|natural_feature|rv_park/i;
const OUTDOOR_NAME_RE = /\b(overlook|scenic|viewpoint|vista|picnic|trailhead|beach|outdoor|boardwalk|nature|lookout)\b/i;
const INDOOR_DINING_HINT_RE = /\b(cafe|diner|grill|bistro|restaurant|indoor|mall|plaza)\b/i;

export function isOutdoorCandidate(place = {}) {
  const types = Array.isArray(place.types) ? place.types.join(" ") : "";
  const name = String(place.name || "");
  const category = String(place.category || place.type || "");
  if (OUTDOOR_TYPE_RE.test(types) || OUTDOOR_TYPE_RE.test(category)) return true;
  if (OUTDOOR_NAME_RE.test(name)) return true;
  if (/playground/i.test(category) || /playground/i.test(name)) return true;
  return false;
}

export function classifyWeatherSeverity(weather = {}) {
  const temp = weather.temperatureF ?? weather.tempF ?? null;
  const precip = weather.precipitationChance ?? weather.precip ?? null;
  const severe = Array.isArray(weather.severeWarnings) ? weather.severeWarnings : [];
  const flags = [];
  if (temp != null && temp >= HEAT_F) flags.push("heat");
  if (temp != null && temp <= COLD_F) flags.push("cold");
  if (precip != null && precip >= HIGH_PRECIP_PCT) flags.push("precip");
  if (severe.length) flags.push("advisory");
  return {
    flags,
    extreme: flags.includes("heat") || flags.includes("cold") || flags.includes("precip") || flags.includes("advisory"),
    tempF: temp,
    precip,
    condition: weather.condition || null,
    advisory: severe[0]?.type || severe[0]?.message || null,
  };
}

/** Rough local solar day window from latitude — no external lib. */
export function daylightWindowForLat(lat, date = new Date()) {
  const latNum = Number(lat);
  if (!Number.isFinite(latNum)) {
    return { sunriseHour: 6.5, sunsetHour: 19.5 };
  }
  const dayOfYear = Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
      - Date.UTC(date.getFullYear(), 0, 0)) / 86400000,
  );
  const decl = 23.44 * Math.sin(((360 / 365) * (dayOfYear - 81) * Math.PI) / 180);
  const latRad = (latNum * Math.PI) / 180;
  const declRad = (decl * Math.PI) / 180;
  const cosHA = -Math.tan(latRad) * Math.tan(declRad);
  if (cosHA >= 1) return { sunriseHour: 12, sunsetHour: 12 };
  if (cosHA <= -1) return { sunriseHour: 0, sunsetHour: 24 };
  const ha = (Math.acos(Math.min(1, Math.max(-1, cosHA))) * 180) / Math.PI;
  const daylightHours = (2 * ha) / 15;
  const sunriseHour = 12 - daylightHours / 2;
  const sunsetHour = 12 + daylightHours / 2;
  return { sunriseHour, sunsetHour };
}

export function isDaylightAt(date, lat) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return true;
  const { sunriseHour, sunsetHour } = daylightWindowForLat(lat, date);
  const hour = date.getHours() + date.getMinutes() / 60;
  return hour >= sunriseHour && hour <= sunsetHour;
}

export function estimateArrivalAlongRoute(departure, fraction, totalHours) {
  const base = departure instanceof Date && !Number.isNaN(departure.getTime())
    ? new Date(departure)
    : new Date();
  const hours = Number(totalHours);
  const frac = Math.min(1, Math.max(0, Number(fraction) || 0));
  if (!Number.isFinite(hours) || hours <= 0) return base;
  return new Date(base.getTime() + frac * hours * 3600 * 1000);
}

/**
 * Opening-hours gate when weekday text / openNow is known.
 * Unknown hours → keep (never over-filter).
 */
export function isLikelyOpenAtArrival(place, arrival) {
  if (!place) return true;
  const openNow = place.currentlyOpen ?? place.openNow;
  // openNow is API-call time — only use as hard signal when arrival is near "now".
  if (arrival instanceof Date && !Number.isNaN(arrival.getTime())) {
    const skewMs = Math.abs(Date.now() - arrival.getTime());
    if (skewMs <= 90 * 60 * 1000 && openNow === false) return false;
    if (skewMs <= 90 * 60 * 1000 && openNow === true) return true;
  }

  const hoursText = place.hours || place.weekdayText || place.opening_hours?.weekday_text?.join("; ");
  if (!hoursText || !(arrival instanceof Date)) return true;

  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayName = dayNames[arrival.getDay()];
  const chunk = String(hoursText).split(";").find(line => line.toLowerCase().includes(dayName));
  if (!chunk) return true;
  if (/closed/i.test(chunk)) return false;
  return true;
}

export function weatherScoreAdjustment(place, weatherClass) {
  if (!weatherClass?.extreme) return { delta: 0, notes: [] };
  const outdoor = isOutdoorCandidate(place);
  const notes = [];
  let delta = 0;
  if (outdoor) {
    delta -= 40;
    if (weatherClass.flags.includes("heat")) notes.push("heat");
    if (weatherClass.flags.includes("cold")) notes.push("cold");
    if (weatherClass.flags.includes("precip")) notes.push("precip");
    if (weatherClass.flags.includes("advisory")) notes.push("advisory");
  } else if (INDOOR_DINING_HINT_RE.test(String(place.name || "")) || /restaurant|cafe|food/i.test(
    Array.isArray(place.types) ? place.types.join(" ") : "",
  )) {
    delta += 8;
    notes.push("indoorOk");
  }
  return { delta, notes };
}

export function daylightScoreAdjustment(place, arrival, lat) {
  if (!isOutdoorCandidate(place)) return { delta: 0, notes: [] };
  if (isDaylightAt(arrival, lat)) return { delta: 0, notes: [] };
  return { delta: -50, notes: ["afterDark"] };
}

export function hoursScoreAdjustment(place, arrival) {
  if (isLikelyOpenAtArrival(place, arrival)) return { delta: 0, notes: [] };
  return { delta: -100, notes: ["closed"] };
}

export function fuelPreferFill(segmentRegular, corridorPrices = []) {
  const valid = corridorPrices.filter(p => Number.isFinite(p));
  if (!valid.length || !Number.isFinite(segmentRegular)) {
    return { preferFill: false, spread: 0 };
  }
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const spread = max - min;
  if (spread < FUEL_SPREAD_MEANINGFUL) {
    return { preferFill: false, spread };
  }
  return {
    preferFill: segmentRegular <= min + 0.02,
    avoidFill: segmentRegular >= max - 0.02,
    spread,
    min,
  };
}

/**
 * Score + reorder a place list. Closed places drop when alternatives remain.
 * Tags contextNotes / contextFlags for prompt annotation — never invents places.
 */
export function applyContextToPlaceList(places = [], {
  weather = null,
  arrival = null,
  lat = null,
  minKeep = 1,
} = {}) {
  if (!places?.length) return [];
  const weatherClass = weather ? classifyWeatherSeverity(weather) : { extreme: false, flags: [] };

  const scored = places.map((place, index) => {
    const w = weatherScoreAdjustment(place, weatherClass);
    const d = daylightScoreAdjustment(place, arrival, lat);
    const h = hoursScoreAdjustment(place, arrival);
    const notes = [...w.notes, ...d.notes, ...h.notes];
    const base = (place.rating != null ? place.rating * 10 : 30) - index;
    return {
      place: {
        ...place,
        contextNotes: notes.length ? notes : undefined,
        contextFlags: notes.length ? notes : undefined,
      },
      score: base + w.delta + d.delta + h.delta,
      closed: notes.includes("closed"),
      afterDark: notes.includes("afterDark"),
    };
  });

  scored.sort((a, b) => b.score - a.score);

  const open = scored.filter(s => !s.closed);
  const keep = open.length >= minKeep ? open : scored;
  // Soft-drop after-dark outdoor when enough alternatives
  const daylightOk = keep.filter(s => !s.afterDark);
  const finalList = daylightOk.length >= minKeep ? daylightOk : keep;

  return finalList.map(s => s.place);
}

export function applyFuelContextToStations(stations = [], fuelInfo = null) {
  if (!stations?.length || !fuelInfo) return stations || [];
  const prefer = Boolean(fuelInfo.preferFill);
  return stations.map((s, i) => ({
    ...s,
    regionalRegular: fuelInfo.regular ?? s.regionalRegular,
    regionalPriceLabel: fuelInfo.regularPrice || s.regionalPriceLabel,
    fuelRegion: fuelInfo.region || s.fuelRegion,
    preferFillHere: prefer,
    contextNotes: prefer && i === 0 ? ["cheaperFuel"] : s.contextNotes,
  })).toSorted((a, b) => {
    if (prefer) return (b.preferFillHere ? 1 : 0) - (a.preferFillHere ? 1 : 0);
    return 0;
  });
}

/** ~30-token structured line per segment. */
export function formatSegmentContextLine(seg = {}, index = 0) {
  const parts = [`SEG${index + 1}`];
  if (seg.mileLabel) parts.push(seg.mileLabel);
  const w = seg.weatherClass;
  if (w?.tempF != null) parts.push(`${w.tempF}F`);
  if (w?.flags?.length) parts.push(w.flags.join("+"));
  else if (w?.condition) parts.push(String(w.condition).slice(0, 16).replace(/\s+/g, "_"));
  parts.push(seg.daylight ? "day" : "night");
  if (seg.fuel?.regularPrice) {
    parts.push(`fuel${seg.fuel.regularPrice.replace("/gal", "")}`);
    if (seg.fuel.region) parts.push(`(${seg.fuel.region})`);
  }
  if (seg.preferIndoor) parts.push("preferIndoor");
  if (seg.preferFill) parts.push("preferFill");
  if (seg.avoidFill) parts.push("avoidFill");
  if (w?.advisory) parts.push(`adv:${String(w.advisory).slice(0, 24).replace(/\s+/g, "_")}`);
  return parts.join(" ");
}

export function formatSegmentContextBlock(segmentContexts = []) {
  if (!segmentContexts?.length) return "";
  const lines = segmentContexts.map((s, i) => formatSegmentContextLine(s, i));
  return [
    "=== SEGMENT CONTEXT (machine-scored — shape ranking; one short clause in stop reasons when relevant) ===",
    ...lines,
    "Rules: preferIndoor → favor indoor dining/activities; preferFill → favor fuel here; night outdoor → avoid overlooks/parks; never invent stops; omit context if a signal is missing.",
  ].join("\n");
}

/**
 * Build segment context records from corridor samples + optional weather/fuel maps.
 * Pure — no I/O.
 */
export function buildSegmentContexts({
  corridor = [],
  weatherByKey = {},
  fuelByKey = {},
  departure = null,
  totalHours = null,
  totalMiles = null,
} = {}) {
  const n = corridor.length || 1;
  const corridorFuelPrices = corridor.map((_, i) => {
    const f = fuelByKey[`seg-${i}`] || fuelByKey[i];
    return f?.regular;
  }).filter(v => Number.isFinite(v));

  return corridor.map((seg, i) => {
    const key = `seg-${i}`;
    const weather = weatherByKey[key] || weatherByKey[seg.city] || null;
    const weatherClass = weather ? classifyWeatherSeverity(weather) : null;
    const fraction = n <= 1 ? 0.5 : i / (n - 1);
    const arrival = estimateArrivalAlongRoute(departure, fraction, totalHours);
    const daylight = isDaylightAt(arrival, seg.lat);
    const fuel = fuelByKey[key] || null;
    const fill = fuelPreferFill(fuel?.regular, corridorFuelPrices);
    const mile = totalMiles != null
      ? `~${Math.round(fraction * totalMiles)}mi`
      : null;

    return {
      index: i,
      key,
      lat: seg.lat,
      lng: seg.lng,
      arrival,
      daylight,
      weatherClass,
      weather,
      fuel,
      preferIndoor: Boolean(weatherClass?.extreme),
      preferFill: Boolean(fill.preferFill),
      avoidFill: Boolean(fill.avoidFill),
      mileLabel: mile,
    };
  });
}
