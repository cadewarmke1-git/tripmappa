/** Post-generation enrichment: Places data, restaurants, weather, alerts, and map markers. */
import {
  geocodeCity,
  searchNearbyServices,
  searchInterestPOIs,
  searchNearbyCategory,
  RADIUS_2MI,
} from "./placesSearch.js";
import { computeTripAlerts } from "./tripAlerts.js";
import { stopsToMapMarkers } from "./mapMarkers.js";
import {
  asArray,
  getTripBudgetCap,
  getActiveServiceCategoryIds,
  NEARBY_SERVICE_CATEGORIES,
} from "./tripAccommodations.js";
import {
  buildFuelIntervalPoints,
  consolidateFuelRoadStops,
  getFuelStopMode,
  sampleRoutePointsEveryMiles,
} from "./fuel.js";
import { buildRoadStopsFromRoute } from "./roadStopsFromPlaces.js";
import { computeBudgetEstimate } from "./budget.js";
import { buildRatingLookup, resolveEnrichedRating } from "./placeRatings.js";
import { parseMilesFromDistance } from "./parsing.js";
import { fetchRestaurantsForStop } from "./restaurantsClient.js";
import { fetchWeatherForStops } from "./weatherClient.js";
import { fetchGeocode } from "./geocodeClient.js";
import { optimizeStopOrder, shouldOptimizeRoute } from "./routeOptimization.js";
import { isContinuousDrive } from "./driveMode.js";

import { dedupePlaces, dedupeRoadStops } from "./placesDedup.js";

const restaurantPreloadInFlight = new Set();
const restaurantPreloadListeners = new Set();

function restaurantPreloadKey(city, lat, lng) {
  if (!city) return null;
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
    return `${city}|${latNum.toFixed(4)}|${lngNum.toFixed(4)}`;
  }
  return city;
}

function notifyRestaurantPreloadListeners() {
  restaurantPreloadListeners.forEach(listener => listener());
}

/** True while enrichGeneratedTrip is fetching restaurants for this city/coords. */
export function isRestaurantPreloadInFlight(city, lat, lng) {
  const key = restaurantPreloadKey(city, lat, lng);
  return key != null && restaurantPreloadInFlight.has(key);
}

export function subscribeRestaurantPreload(listener) {
  restaurantPreloadListeners.add(listener);
  return () => restaurantPreloadListeners.delete(listener);
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

function interestToMarkerCategory(interest) {
  if (/playground|park/i.test(interest)) return "playground";
  if (/music|comedy|drive-in|antique|flea|sports bar/i.test(interest)) return "entertainment";
  if (/wifi|remote work/i.test(interest)) return "wifi";
  if (/kid friendly/i.test(interest)) return "playground";
  if (/prayer/i.test(interest)) return "religious";
  return "poi";
}

function serviceCategoriesForAnswers(answers) {
  const ids = getActiveServiceCategoryIds(answers);
  return ids
    .map(id => NEARBY_SERVICE_CATEGORIES.find(c => c.id === id))
    .filter(Boolean);
}

async function resolveStopGeo(stop, mapsReady) {
  if (stop.lat != null && stop.lng != null) {
    const lat = Number(stop.lat);
    const lng = Number(stop.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  if (!stop.city) return null;
  if (mapsReady) return geocodeCity(stop.city);
  return fetchGeocode(stop.city);
}

async function resolveDestinationGeo(destination, routeInfo, mapsReady) {
  if (routeInfo?.destLat != null && routeInfo?.destLng != null) {
    const lat = Number(routeInfo.destLat);
    const lng = Number(routeInfo.destLng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  const points = routeInfo?.routePoints;
  if (points?.length) {
    const last = points[points.length - 1];
    if (last?.lat != null && last?.lng != null) {
      const lat = Number(last.lat);
      const lng = Number(last.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  }
  if (destination) return resolveStopGeo({ city: destination }, mapsReady);
  return null;
}

async function assignRestaurantsForCity(map, city, geo, answers, limit = 6) {
  if (!city) return;
  if (!geo?.lat || !geo?.lng) {
    map[city] = [];
    return;
  }
  const preloadKey = restaurantPreloadKey(city, geo.lat, geo.lng);
  if (preloadKey) restaurantPreloadInFlight.add(preloadKey);
  try {
    const result = await fetchRestaurantsForStop({
      lat: geo.lat,
      lng: geo.lng,
      city,
      answers,
      limit,
    });
    if (result.error) {
      map[city] = [];
      return;
    }
    map[city] = result.restaurants || [];
  } finally {
    if (preloadKey) {
      restaurantPreloadInFlight.delete(preloadKey);
      notifyRestaurantPreloadListeners();
    }
  }
}

function isFoodRoadStop(rs) {
  const cat = (rs.category || "").toLowerCase();
  return /food|rest|dining|meal/i.test(cat)
    || /mcdonald|starbucks|restaurant|diner|food/i.test(rs.name || "");
}

async function enrichFoodRoadStopRestaurants(roadStops, answers) {
  for (const rs of roadStops) {
    if (!isFoodRoadStop(rs) || rs.lat == null || rs.lng == null) continue;
    const quickResult = await fetchRestaurantsForStop({
      lat: rs.lat,
      lng: rs.lng,
      city: rs.location || rs.name,
      answers,
      roadStop: true,
      limit: 4,
    });
    if (!quickResult.error) {
      rs.nearbyRestaurants = (quickResult.restaurants || []).slice(0, 2);
    }
  }
}

export async function enrichGeneratedTrip({
  answers,
  routeInfo,
  stops = [],
  roadStops = [],
  customStops = [],
  selectedLodging = [],
  timingMode = "leave_now",
  departureTime = null,
  origin = null,
  destination = null,
  mapsReady = true,
  signal = null,
}) {
  throwIfAborted(signal);
  const continuousDrive = isContinuousDrive(answers);
  const nearbyServicesByCity = {};
  const activitiesByCity = {};
  const restaurantsByCity = {};
  const weatherByCity = {};
  const optionalStopCards = [];
  const poiMarkers = [];
  let enrichedStops = continuousDrive ? [] : stops.map(s => ({ ...s }));
  let safeRoadStops = dedupeRoadStops(roadStops.map(rs => ({ ...rs })));
  let routeOptimized = false;

  if (!continuousDrive && shouldOptimizeRoute(answers, enrichedStops) && origin && destination) {
    for (const stop of enrichedStops) {
      if (!stop.city || (stop.lat != null && stop.lng != null)) continue;
      const geo = await resolveStopGeo(stop, mapsReady);
      if (geo) {
        stop.lat = geo.lat;
        stop.lng = geo.lng;
      }
    }
    const { stops: reordered, optimized } = await optimizeStopOrder(origin, destination, enrichedStops);
    if (optimized) {
      enrichedStops = reordered;
      routeOptimized = true;
    }
  }

  if (mapsReady && routeInfo?.routePoints?.length) {
    const llmRoadStopCount = roadStops.filter(rs => rs.fromLlm).length;
    if (llmRoadStopCount < 2) {
      const corridorRoadStops = await buildRoadStopsFromRoute(answers, routeInfo);
      safeRoadStops = dedupeRoadStops([...safeRoadStops, ...corridorRoadStops]);
    } else {
      safeRoadStops = dedupeRoadStops(safeRoadStops);
    }
  } else {
    safeRoadStops = dedupeRoadStops(safeRoadStops);
  }

  if (continuousDrive) {
    safeRoadStops = safeRoadStops
      .filter(rs => /fuel|rest|gas|diesel|ev|charge|truck stop|pilot|love'?s|ta\b/i.test(`${rs.category || ""} ${rs.name || ""}`))
      .concat(safeRoadStops.filter(rs => !/fuel|rest|gas|diesel|ev|charge|truck stop|pilot|love'?s|ta\b/i.test(`${rs.category || ""} ${rs.name || ""}`)))
      .slice(0, 16);
  }

  const interests = mapsReady
    ? asArray(answers?.stops_interests).filter(i => i !== "No specific interests")
    : [];
  const serviceCats = mapsReady ? serviceCategoriesForAnswers(answers) : [];
  const wantsPlaygrounds = mapsReady && interests.some(i => /playground|park/i.test(i));

  for (const stop of enrichedStops) {
    throwIfAborted(signal);
    if (!stop.city) continue;
    const geo = await resolveStopGeo(stop, mapsReady);
    if (!geo) continue;
    stop.lat = stop.lat ?? geo.lat;
    stop.lng = stop.lng ?? geo.lng;

    if (mapsReady) {
      nearbyServicesByCity[stop.city] = await searchNearbyServices(geo.lat, geo.lng, serviceCats);

      for (const interest of interests) {
        const pois = await searchInterestPOIs(geo.lat, geo.lng, interest);
        if (!activitiesByCity[stop.city]) activitiesByCity[stop.city] = [];
        pois.forEach(p => {
          const entry = { ...p, interest, admissionEstimate: interest.includes("Kid friendly") ? "$15–45/person (est.)" : null };
          activitiesByCity[stop.city].push(entry);
          if (p.lat != null && p.lng != null) {
            poiMarkers.push({
              id: p.id,
              lat: p.lat,
              lng: p.lng,
              category: interestToMarkerCategory(interest),
              title: p.name,
              subtitle: p.address || `${p.distanceMiles ?? "?"} mi`,
              hours: p.hours,
              rating: p.rating,
            });
          }
        });
      }

      Object.entries(nearbyServicesByCity[stop.city] || {}).forEach(([key, items]) => {
        items?.forEach(item => {
          if (item.lat == null || item.lng == null) return;
          let cat = null;
          if (key === "hospital" || key === "pharmacy" || key === "urgent_care" || key === "dialysis") cat = "medical";
          if (key === "vet") cat = "vet";
          if (!cat) return;
          poiMarkers.push({
            id: `svc-${key}-${item.id}`,
            lat: item.lat,
            lng: item.lng,
            category: cat,
            title: item.name,
            subtitle: item.phone ? `${item.distanceMiles ?? "?"} mi · ${item.phone}` : `${item.distanceMiles ?? "?"} mi`,
          });
        });
      });
    }

    await assignRestaurantsForCity(restaurantsByCity, stop.city, geo, answers, 6);
  }

  // Day / simple trips: enrich destination when no overnight stops
  const weatherStops = [...enrichedStops];
  let destGeo = null;
  if (destination) {
    destGeo = await resolveDestinationGeo(destination, routeInfo, mapsReady);
    if (destGeo && !enrichedStops.length) {
      await assignRestaurantsForCity(restaurantsByCity, destination, destGeo, answers, 6);
      weatherStops.push({ city: destination, lat: destGeo.lat, lng: destGeo.lng });
    }
  }

  const weatherData = await fetchWeatherForStops(weatherStops);
  Object.assign(weatherByCity, weatherData.weatherByCity || {});

  await enrichFoodRoadStopRestaurants(safeRoadStops, answers);

  if (wantsPlaygrounds && routeInfo?.routePoints?.length) {
    const routeSamples = sampleRoutePointsEveryMiles(routeInfo.routePoints, 30);
    for (const pt of routeSamples) {
      const parks = await searchNearbyCategory(pt.lat, pt.lng, {
        keyword: "playground park",
        radius: RADIUS_2MI,
        maxResults: 2,
      });
      parks.forEach(p => {
        optionalStopCards.push({ ...p, type: "playground" });
        if (p.lat != null && p.lng != null) {
          poiMarkers.push({
            id: `pg-${p.id}`,
            lat: p.lat,
            lng: p.lng,
            category: "playground",
            title: p.name,
            subtitle: `${p.distanceMiles ?? "?"} mi from route`,
            action: "add",
          });
        }
      });
    }
  }

  const fuelMode = getFuelStopMode(answers);
  const totalMiles = parseMilesFromDistance(routeInfo?.distance);
  const fuelIntervalPoints = fuelMode !== "none" && routeInfo?.routePoints?.length
    ? buildFuelIntervalPoints(routeInfo.routePoints, enrichedStops.length, totalMiles, answers)
    : [];

  const budget = computeBudgetEstimate(answers, routeInfo, enrichedStops, {
    roadStops: safeRoadStops,
    selectedLodging,
    restaurantsByCity,
  });
  const depTime = departureTime || (timingMode === "leave_now" ? new Date() : null);

  const tripAlerts = computeTripAlerts({
    answers,
    routeInfo,
    stops: enrichedStops,
    roadStops: safeRoadStops,
    fuelStopPoints: fuelIntervalPoints,
    nearbyServicesByCity,
    budgetTotal: budget.total,
    departureTime: depTime,
  });

  const weatherAlerts = (weatherData.severeAlerts || []).filter(
    a => !tripAlerts.some(t => t.id === a.id),
  );
  tripAlerts.unshift(...weatherAlerts);

  const cap = getTripBudgetCap(answers);
  if (cap != null && budget.total != null && cap - budget.total <= 50 && enrichedStops.length) {
    const last = enrichedStops[enrichedStops.length - 1];
    if (last.lat != null && last.lng != null) {
      poiMarkers.push({
        id: "budget-warning-marker",
        lat: last.lat,
        lng: last.lng,
        category: "budget",
        title: "Budget warning",
        subtitle: `$${Math.round(budget.total)} of $${cap} used`,
        alertId: "alert-budget-warning",
      });
    }
  }

  const mapMarkers = stopsToMapMarkers(enrichedStops, safeRoadStops, customStops, poiMarkers, answers);

  safeRoadStops = dedupeRoadStops(safeRoadStops);
  safeRoadStops = consolidateFuelRoadStops(
    safeRoadStops,
    answers,
    routeInfo,
    enrichedStops.length,
  );

  const ratingLookup = buildRatingLookup(restaurantsByCity);
  for (const rs of safeRoadStops) {
    const rating = resolveEnrichedRating(rs, ratingLookup);
    if (rating != null) rs.rating = rating;
  }
  for (const stop of enrichedStops) {
    const rating = resolveEnrichedRating(stop, ratingLookup);
    if (rating != null) stop.rating = rating;
  }

  return {
    stops: enrichedStops,
    roadStops: safeRoadStops,
    nearbyServicesByCity,
    activitiesByCity,
    restaurantsByCity,
    weatherByCity,
    routeOptimized,
    optionalStopCards,
    tripAlerts,
    liveTripTips: [],
    destGeo,
    mapMarkers,
  };
}
