/** Post-generation enrichment: Places data, alerts, and map markers. */
import {
  geocodeCity,
  searchNearbyServices,
  searchInterestPOIs,
  searchRestaurants,
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
import { buildFuelIntervalPoints, getFuelStopMode, sampleRoutePoints } from "./fuel.js";
import { computeBudgetEstimate } from "./budget.js";
import { parseMilesFromDistance } from "./parsing.js";

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

export async function enrichGeneratedTrip({
  answers,
  routeInfo,
  stops = [],
  roadStops = [],
  customStops = [],
  selectedLodging = [],
  timingMode = "leave_now",
  departureTime = null,
}) {
  const nearbyServicesByCity = {};
  const activitiesByCity = {};
  const restaurantsByCity = {};
  const optionalStopCards = [];
  const poiMarkers = [];
  const enrichedStops = stops.map(s => ({ ...s }));
  const safeRoadStops = roadStops.map(rs => ({ ...rs }));

  const interests = asArray(answers?.stops_interests).filter(i => i !== "No specific interests");
  const serviceCats = serviceCategoriesForAnswers();
  const wantsPlaygrounds = interests.some(i => /playground|park/i.test(i));

  for (const stop of enrichedStops) {
    if (!stop.city) continue;
    const geo = await geocodeCity(stop.city);
    if (!geo) continue;
    stop.lat = stop.lat ?? geo.lat;
    stop.lng = stop.lng ?? geo.lng;

    nearbyServicesByCity[stop.city] = await searchNearbyServices(geo.lat, geo.lng, serviceCats);
    restaurantsByCity[stop.city] = await searchRestaurants(geo.lat, geo.lng, answers);

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

  if (wantsPlaygrounds && routeInfo?.routePoints?.length) {
    const routeSamples = sampleRoutePoints(routeInfo.routePoints, 4);
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

  const budget = computeBudgetEstimate(answers, routeInfo, [], { roadStops: safeRoadStops, selectedLodging });
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

  const mapMarkers = stopsToMapMarkers(enrichedStops, safeRoadStops, customStops, poiMarkers);

  return {
    stops: enrichedStops,
    roadStops: safeRoadStops,
    nearbyServicesByCity,
    activitiesByCity,
    restaurantsByCity,
    optionalStopCards,
    tripAlerts,
    mapMarkers,
  };
}
