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
  NEARBY_SERVICE_CATEGORIES,
  getTripBudgetCap,
} from "./tripAccommodations.js";
import { buildFuelIntervalPoints, getFuelStopMode, sampleRoutePointsEveryMiles } from "./fuel.js";
import { buildRoadStopsFromRoute } from "./roadStopsFromPlaces.js";
import { computeBudgetEstimate } from "./budget.js";
import { parseMilesFromDistance } from "./parsing.js";
import { fetchRestaurantsForStop } from "./restaurantsClient.js";
import { fetchWeatherForStops } from "./weatherClient.js";
import { fetchGeocode } from "./geocodeClient.js";
import { fetchLiveTripTips } from "./tripTipsClient.js";
import { optimizeStopOrder, shouldOptimizeRoute } from "./routeOptimization.js";

import { dedupePlaces } from "./placesDedup.js";

const BASE_SERVICE_IDS = [
  "pharmacy", "hospital", "urgent_care", "auto_repair", "atm",
  "car_wash", "laundry", "tire", "windshield", "shipping",
];

function interestToMarkerCategory(interest) {
  if (/playground|park/i.test(interest)) return "playground";
  if (/music|comedy|drive-in|antique|flea|sports bar/i.test(interest)) return "entertainment";
  if (/wifi|remote work/i.test(interest)) return "wifi";
  if (/kid friendly/i.test(interest)) return "playground";
  return "poi";
}

function serviceCategoriesForAnswers() {
  return BASE_SERVICE_IDS
    .map(id => NEARBY_SERVICE_CATEGORIES.find(c => c.id === id))
    .filter(Boolean);
}

async function resolveStopGeo(stop, mapsReady) {
  if (stop.lat != null && stop.lng != null) {
    return { lat: stop.lat, lng: stop.lng };
  }
  if (!stop.city) return null;
  if (mapsReady) return geocodeCity(stop.city);
  return fetchGeocode(stop.city);
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
}) {
  const nearbyServicesByCity = {};
  const activitiesByCity = {};
  const restaurantsByCity = {};
  const weatherByCity = {};
  const optionalStopCards = [];
  const poiMarkers = [];
  let enrichedStops = stops.map(s => ({ ...s }));
  let safeRoadStops = roadStops.map(rs => ({ ...rs }));
  let routeOptimized = false;

  if (shouldOptimizeRoute(answers, enrichedStops) && origin && destination) {
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
    const corridorRoadStops = await buildRoadStopsFromRoute(answers, routeInfo);
    safeRoadStops = dedupePlaces(corridorRoadStops);
  }

  const interests = mapsReady
    ? asArray(answers?.stops_interests).filter(i => i !== "No specific interests")
    : [];
  const serviceCats = mapsReady ? serviceCategoriesForAnswers() : [];
  const wantsPlaygrounds = mapsReady && interests.some(i => /playground|park/i.test(i));

  for (const stop of enrichedStops) {
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
          const cat = key === "hospital" || key === "pharmacy" ? "medical" : null;
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

    restaurantsByCity[stop.city] = (await fetchRestaurantsForStop({
      lat: geo.lat,
      lng: geo.lng,
      city: stop.city,
      answers,
      limit: 6,
    })).restaurants;
  }

  // Day / simple trips: enrich destination when no overnight stops
  const weatherStops = [...enrichedStops];
  let destGeo = null;
  if (destination) {
    destGeo = routeInfo?.destLat != null && routeInfo?.destLng != null
      ? { lat: routeInfo.destLat, lng: routeInfo.destLng }
      : await resolveStopGeo({ city: destination }, mapsReady);
    if (destGeo && !enrichedStops.length) {
      restaurantsByCity[destination] = (await fetchRestaurantsForStop({
        lat: destGeo.lat,
        lng: destGeo.lng,
        city: destination,
        answers,
        limit: 6,
      })).restaurants;
      weatherStops.push({ city: destination, lat: destGeo.lat, lng: destGeo.lng });
    }
  }

  const weatherData = await fetchWeatherForStops(weatherStops);
  Object.assign(weatherByCity, weatherData.weatherByCity || {});

  for (const rs of safeRoadStops) {
    const cat = (rs.category || "").toLowerCase();
    if (!/food|rest|dining|meal/i.test(cat) && !/mcdonald|starbucks|restaurant|diner|food/i.test(rs.name || "")) {
      continue;
    }
    if (rs.lat == null || rs.lng == null) continue;
    const quick = (await fetchRestaurantsForStop({
      lat: rs.lat,
      lng: rs.lng,
      city: rs.location || rs.name,
      answers,
      roadStop: true,
      limit: 4,
    })).restaurants;
    rs.nearbyRestaurants = quick.slice(0, 2);
  }

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

  const budget = computeBudgetEstimate(answers, routeInfo, [], {
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

  const waypoints = enrichedStops
    .filter(s => s.lat != null && s.lng != null)
    .map(s => ({ lat: s.lat, lng: s.lng }));
  if (destGeo) waypoints.push(destGeo);

  let liveTripTips = [];
  if (origin && destination) {
    const tipsResult = await fetchLiveTripTips({
      origin,
      destination,
      routePoints: routeInfo?.routePoints || [],
      waypoints,
    });
    liveTripTips = tipsResult.tips || [];
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
    liveTripTips,
    destGeo,
    mapMarkers,
  };
}
