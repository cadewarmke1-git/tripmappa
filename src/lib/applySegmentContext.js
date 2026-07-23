/**
 * Apply trip-segment weather / daylight / fuel context to a placesContext pool
 * at read/generation time — never writes into corridor caches.
 */
import { tripMappaApiHeaders } from "./tripmappaHeaders.js";
import { fetchWeatherForStops } from "./weatherClient.js";
import { parseHoursFromDuration } from "./parsing.js";
import {
  applyContextToPlaceList,
  applyFuelContextToStations,
  buildSegmentContexts,
  formatSegmentContextBlock,
} from "./segmentContext.js";

async function fetchRegionalFuelPrices(points) {
  if (!points?.length) return {};
  try {
    const res = await fetch("/api/fuel-stations", {
      method: "POST",
      headers: tripMappaApiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ mode: "regional-prices", points }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data.pricesById || {};
  } catch {
    return {};
  }
}

function weatherStopsFromCorridor(corridor = [], cities = []) {
  const stops = [];
  corridor.forEach((seg, i) => {
    if (seg?.lat == null || seg?.lng == null) return;
    stops.push({
      city: `seg-${i}`,
      lat: seg.lat,
      lng: seg.lng,
    });
  });
  cities.forEach((c, i) => {
    if (c?.lat == null || c?.lng == null) return;
    stops.push({
      city: c.city || `city-${i}`,
      lat: c.lat,
      lng: c.lng,
    });
  });
  return stops.slice(0, 12);
}

/**
 * @param {object} placesContext — from buildPlacesContext (unfiltered cache-backed pool)
 * @param {object} routeInfo
 * @param {{ departureTime?: Date|null, answers?: object }} options
 */
export async function applySegmentContextToPlaces(placesContext, routeInfo, options = {}) {
  if (!placesContext?.corridor?.length) {
    return {
      ...placesContext,
      segmentContexts: [],
      segmentContextPrompt: "",
    };
  }

  const departure = options.departureTime instanceof Date
    ? options.departureTime
    : (options.departureTime ? new Date(options.departureTime) : new Date());
  const totalHours = parseHoursFromDuration(routeInfo?.duration);
  const totalMiles = placesContext.boundary?.totalMiles
    ?? null;

  let weatherByCity = {};
  try {
    const weatherStops = weatherStopsFromCorridor(placesContext.corridor, placesContext.cities);
    if (weatherStops.length) {
      const weatherData = await fetchWeatherForStops(weatherStops);
      weatherByCity = weatherData.weatherByCity || {};
    }
  } catch {
    weatherByCity = {};
  }

  const fuelPoints = placesContext.corridor.map((seg, i) => ({
    id: `seg-${i}`,
    lat: seg.lat,
    lng: seg.lng,
  }));
  const fuelByKey = await fetchRegionalFuelPrices(fuelPoints);

  const segmentContexts = buildSegmentContexts({
    corridor: placesContext.corridor,
    weatherByKey: weatherByCity,
    fuelByKey,
    departure,
    totalHours,
    totalMiles,
  });

  const corridor = placesContext.corridor.map((seg, i) => {
    const ctx = segmentContexts[i];
    const weather = ctx?.weather || null;
    const arrival = ctx?.arrival || departure;

    let restaurants = applyContextToPlaceList(seg.restaurants || [], {
      weather,
      arrival,
      lat: seg.lat,
      minKeep: 1,
    });
    let playgrounds = applyContextToPlaceList(seg.playgrounds || [], {
      weather,
      arrival,
      lat: seg.lat,
      minKeep: 0,
    });
    let gasStations = applyFuelContextToStations(seg.gasStations || [], ctx?.fuel);
    if (ctx?.preferFill) {
      gasStations = gasStations.map((g, idx) => ({
        ...g,
        preferFillHere: true,
        contextNotes: idx === 0
          ? [...new Set([...(g.contextNotes || []), "cheaperFuel"])]
          : g.contextNotes,
      }));
    } else if (ctx?.avoidFill) {
      gasStations = gasStations.map(g => ({
        ...g,
        preferFillHere: false,
        contextNotes: [...new Set([...(g.contextNotes || []), "pricierFuel"])],
      }));
    }

    return {
      ...seg,
      restaurants,
      playgrounds,
      gasStations,
      segmentContext: ctx,
    };
  });

  const cities = (placesContext.cities || []).map((city) => {
    const weather = weatherByCity[city.city] || null;
    // Overnight cities: approximate arrival as mid-trip if unknown
    const arrival = departure;
    return {
      ...city,
      hotels: city.hotels || [],
      dietaryRestaurants: applyContextToPlaceList(city.dietaryRestaurants || [], {
        weather,
        arrival,
        lat: city.lat,
        minKeep: 1,
      }),
      weather,
    };
  });

  const segmentContextPrompt = formatSegmentContextBlock(segmentContexts);

  return {
    ...placesContext,
    corridor,
    cities,
    segmentContexts,
    segmentContextPrompt,
    contextAppliedAt: Date.now(),
  };
}

export { formatSegmentContextBlock };
