import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_LIBRARIES, LEG_MAP_STYLES, TRIP_ROUTE_GOLD } from "../lib/constants.js";
import { applyMapThemeStyles } from "../lib/mapStyles.js";
import { resolveMapCenter } from "../lib/mapViewport.js";
import {
  isTruckVehicle,
  isRvVehicle,
  hasPref,
  isScenicRoute,
} from "../lib/vehicles.js";
import { parseMilesFromDistance, parseHoursFromDuration } from "../lib/parsing.js";
import { computeNightDrivingBlocks, computeLowFuelSegmentPath } from "../lib/tripMapSegments.js";
import { fetchTruckRoute, shouldUseTruckRouting } from "../lib/truckRoutingApi.js";
import { deriveCitiesAlongRoute, parseCityStateFromFormattedAddress } from "../lib/routeCities.js";
import { isTowingSelected, getFuelRangeMiles } from "../lib/tripAccommodations.js";
import {
  buildRouteSignature,
  getCachedDirections,
  setCachedDirections,
  buildDirectionsCacheEntry,
} from "../lib/directionsCache.js";

/**
 * Map / routing state and effects for App.
 * Pass answers/origin/dest/theme/toast via params. itinerarySync via ref (set after useItinerarySync).
 */
export function useMapState({
  answers,
  origin,
  dest,
  setOrigin,
  setDest,
  timingMode,
  arriveByDate,
  theme,
  toastFnRef,
  view,
  tab,
  generated,
  tripLegs,
  itinerarySyncRef,
}) {
  const [exploreRangeEnabled, setExploreRangeEnabled] = useState(false);
  const [exploreRangeDriveSeconds, setExploreRangeDriveSeconds] = useState(7200);
  const [exploreRangePolygon, setExploreRangePolygon] = useState([]);
  const [exploreRangeLoading, setExploreRangeLoading] = useState(false);
  const [exploreRangeError, setExploreRangeError] = useState(null);
  const [exploreOriginCoords, setExploreOriginCoords] = useState(null);
  const [exploreSearchQuery, setExploreSearchQuery] = useState("");
  const exploreRangeAbortRef = useRef(null);
  const [exploreCorridorPath, setExploreCorridorPath] = useState([]);
  const [exploreCorridorStops, setExploreCorridorStops] = useState([]);
  const [exploreStatusMessage, setExploreStatusMessage] = useState(null);
  const [exploreFromCoords, setExploreFromCoords] = useState(null);

  const [mapStyle, setMapStyle] = useState("standard");
  const [mapStyleOpen, setMapStyleOpen] = useState(false);
  const [trafficAlert, setTrafficAlert] = useState(false);
  const [mapMarkers, setMapMarkers] = useState([]);
  const [segmentsEmptyForRoute, setSegmentsEmptyForRoute] = useState(null);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [mapFocusTarget, setMapFocusTarget] = useState(null);
  const [highlightedStopId, setHighlightedStopId] = useState(null);
  const [routeError, setRouteError] = useState(null);
  const highlightTimerRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    id: "tripmappa-google-maps",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
    libraries: GOOGLE_LIBRARIES,
    preventGoogleFontsLoading: true,
  });
  const [routeInfo, setRouteInfo] = useState(null);
  const [routePath, setRoutePath] = useState(null);
  const [truckRoutePath, setTruckRoutePath] = useState(null);
  const [directionsResult, setDirectionsResult] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const mapCenter = useMemo(
    () => resolveMapCenter(routeInfo, routePath),
    [routeInfo, routePath],
  );
  const originRef = useRef(null);
  const destRef = useRef(null);
  const heroOriginRef = useRef(null);
  const heroDestRef = useRef(null);
  const heroOriginAcRef = useRef(null);
  const heroDestAcRef = useRef(null);
  const navigateOriginRef = useRef(null);
  const navigateDestRef = useRef(null);
  const mapRef = useRef(null);
  const pendingFitBoundsRef = useRef(null);
  const polylineRef = useRef(null);
  const polylinesRef = useRef([]);
  const polylineAnimRef = useRef(null);
  const [mapReadyView, setMapReadyView] = useState(null);
  const mapReady = mapReadyView === view;
  const setMapReady = useCallback((ready) => {
    if (ready) setMapReadyView(view);
    else setMapReadyView(null);
  }, [view]);

  const directionsFetchRef = useRef(null);

  const normalizeMapPoint = useCallback((point) => {
    if (!point) return null;
    const lat = typeof point.lat === "function" ? point.lat() : point.lat;
    const lng = typeof point.lng === "function" ? point.lng() : point.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, []);

  const scheduleFitBounds = useCallback((points, padding = 60) => {
    if (!points?.length || points.length < 2 || !window.google?.maps) return;
    const normalized = points.map(normalizeMapPoint).filter(Boolean);
    if (normalized.length < 2) return;

    const applyFitBounds = () => {
      if (!mapRef.current) return false;
      const bounds = new window.google.maps.LatLngBounds();
      normalized.forEach((p) => bounds.extend(p));
      mapRef.current.fitBounds(bounds, { padding });
      pendingFitBoundsRef.current = null;
      return true;
    };

    if (applyFitBounds()) return;
    pendingFitBoundsRef.current = { points: normalized, padding };
  }, [normalizeMapPoint]);

  const flushPendingFitBounds = useCallback(() => {
    const pending = pendingFitBoundsRef.current;
    if (!pending || !mapRef.current || !window.google?.maps) return;
    requestAnimationFrame(() => {
      if (!mapRef.current || !window.google?.maps) return;
      window.google.maps.event.trigger(mapRef.current, "resize");
      const bounds = new window.google.maps.LatLngBounds();
      pending.points.forEach((p) => bounds.extend(p));
      mapRef.current.fitBounds(bounds, { padding: pending.padding });
      pendingFitBoundsRef.current = null;
    });
  }, []);

  const fetchDirections = useCallback((vehicleType) => {
    const originVal = originRef.current?.value?.trim() || origin?.trim();
    const destVal = destRef.current?.value?.trim() || dest?.trim();
    if (!originVal || !destVal) return Promise.resolve({ ok: false });

    const vehicle = vehicleType || answers.vehicle || "Car";

    if (shouldUseTruckRouting({ ...answers, vehicle })) {
      setRouteLoading(true);
      setTrafficAlert(false);
      const requestKey = `truck|${originVal}|${destVal}|${vehicle}|${answers.truck_height}|${answers.truck_weight}|${answers.truck_hazmat}`;
      if (directionsFetchRef.current?.key === requestKey) {
        return directionsFetchRef.current.promise;
      }

      const promise = fetchTruckRoute(originVal, destVal, { ...answers, vehicle })
        .then(async (data) => {
          setRouteLoading(false);
          setRouteError(null);
          const restrictions = data.restrictions || [];
          if (restrictions.some(r => r.severity === "warning" || r.severity === "critical")) {
            setTrafficAlert(true);
          }

          const routePoints = data.routePoints || [];
          const citiesAlongRoute = await deriveCitiesAlongRoute(routePoints, {
            origin: originVal,
            destination: destVal,
            distance: data.distance,
          });
          const nextRouteInfo = {
            distance: data.distance,
            duration: data.duration,
            start: originVal.split(",")[0],
            end: destVal.split(",")[0],
            origin: originVal,
            destination: destVal,
            originLat: routePoints[0]?.lat,
            originLng: routePoints[0]?.lng,
            destLat: routePoints[routePoints.length - 1]?.lat,
            destLng: routePoints[routePoints.length - 1]?.lng,
            citiesAlongRoute,
            routePoints,
            vehicleType: vehicle,
            timingMode,
            arriveBy: timingMode === "arrive_by" ? arriveByDate : null,
            scenic: isScenicRoute(answers),
            truckSafe: true,
            rvSafe: false,
            routeProvider: "here",
            truckHeight: answers.truck_height,
            truckWeight: answers.truck_weight,
            truckHazmat: answers.truck_hazmat,
            restrictions,
            weighStations: data.weighStations || [],
            herePolyline: data.polyline,
          };

          setRouteInfo(nextRouteInfo);
          setOrigin(originVal);
          setDest(destVal);
          setTruckRoutePath(routePoints);
          setRoutePath(routePoints);
          setDirectionsResult(null);

          scheduleFitBounds(routePoints, 60);

          return { ok: true, routeInfo: nextRouteInfo };
        })
        .catch((err) => {
          setRouteLoading(false);
          const msg = err.message || "Could not calculate truck route. Check addresses and try again.";
          setRouteError(msg);
          setRouteInfo(null);
          setRoutePath(null);
          setTruckRoutePath(null);
          setDirectionsResult(null);
          toastFnRef.current?.(msg, { duration: 7000 });
          return { ok: false };
        });

      directionsFetchRef.current = { key: requestKey, promise };
      promise.finally(() => {
        if (directionsFetchRef.current?.key === requestKey) {
          directionsFetchRef.current = null;
        }
      });
      return promise;
    }

    if (!window.google) return Promise.resolve({ ok: false });

    const scenic = isScenicRoute(answers);
    const signature = buildRouteSignature({ origin: originVal, destination: destVal });
    const cached = getCachedDirections(signature);
    if (cached) {
      setRouteError(null);
      setRouteInfo({
        ...cached.routeInfo,
        vehicleType: vehicle,
        timingMode,
        arriveBy: timingMode === "arrive_by" ? arriveByDate : null,
        scenic,
        truckSafe: isTruckVehicle(vehicle),
        rvSafe: isRvVehicle(vehicle),
        truckHeight: answers.truck_height,
        truckWeight: answers.truck_weight,
        truckHazmat: answers.truck_hazmat,
        rvHeight: answers.rv_height,
        rvWeight: answers.rv_weight,
        rvTowing: answers.rv_towing,
      });
      setOrigin(originVal);
      setDest(destVal);
      setRoutePath(cached.routePath);
      setTruckRoutePath(null);
      setDirectionsResult(cached.directionsResult);
      scheduleFitBounds(cached.routePoints, 60);
      return Promise.resolve({ ok: true, routeInfo: cached.routeInfo, fromCache: true });
    }

    setRouteLoading(true);
    setTrafficAlert(false);

    const routeRequest = {
      origin: originVal,
      destination: destVal,
      travelMode: window.google.maps.TravelMode.DRIVING,
    };

    if (timingMode === "leave_now") {
      routeRequest.drivingOptions = {
        departureTime: new Date(),
        trafficModel: window.google.maps.TrafficModel.BEST_GUESS,
      };
    } else if (timingMode === "arrive_by" && arriveByDate) {
      routeRequest.drivingOptions = {
        arrivalTime: new Date(arriveByDate),
        trafficModel: window.google.maps.TrafficModel.BEST_GUESS,
      };
    }

    if (isTruckVehicle(vehicle)) {
      routeRequest.avoidFerries = true;
      routeRequest.provideRouteAlternatives = true;
    } else if (isRvVehicle(vehicle)) {
      routeRequest.avoidFerries = true;
      routeRequest.provideRouteAlternatives = true;
    }

    if (scenic || hasPref(answers, "Avoid highways")) routeRequest.avoidHighways = true;
    if (hasPref(answers, "Avoid tolls")) routeRequest.avoidTolls = true;
    if (isTowingSelected(answers)) {
      routeRequest.avoidHighways = true;
      routeRequest.provideRouteAlternatives = true;
      routeRequest.avoidFerries = true;
    }

    const service = new window.google.maps.DirectionsService();
    const requestKey = `${originVal}|${destVal}|${vehicle}|${timingMode}|${arriveByDate || ""}|${scenic}`;
    if (directionsFetchRef.current?.key === requestKey) {
      return directionsFetchRef.current.promise;
    }

    const promise = new Promise((resolve) => {
      service.route(routeRequest, (result, status) => {
        setRouteLoading(false);
        if (status === "OK") {
          setRouteError(null);
          const route = result.routes[0];
          const leg = route.legs[0];
          const warnings = route.warnings || [];
          const hasTrafficDelay = warnings.some(w => /traffic|delay|congestion|slow/i.test(w))
            || route.legs.some(l => l.duration_in_traffic && l.duration_in_traffic.value > l.duration.value * 1.08);
          if (warnings.length > 0 || hasTrafficDelay) setTrafficAlert(true);

          const citiesAlongRoute = [];
          const seenCities = new Set();
          route.legs[0].steps.forEach(step => {
            if (!step.end_address) return;
            const cityState = parseCityStateFromFormattedAddress(step.end_address);
            if (cityState && !seenCities.has(cityState)) {
              seenCities.add(cityState);
              citiesAlongRoute.push(cityState);
            }
          });

          const nextRouteInfo = {
            distance: leg.distance.text,
            duration: leg.duration.text,
            start: leg.start_address.split(",")[0],
            end: leg.end_address.split(",")[0],
            origin: originVal,
            destination: destVal,
            originLat: typeof leg.start_location.lat === "function" ? leg.start_location.lat() : leg.start_location.lat,
            originLng: typeof leg.start_location.lng === "function" ? leg.start_location.lng() : leg.start_location.lng,
            destLat: typeof leg.end_location.lat === "function" ? leg.end_location.lat() : leg.end_location.lat,
            destLng: typeof leg.end_location.lng === "function" ? leg.end_location.lng() : leg.end_location.lng,
            citiesAlongRoute: citiesAlongRoute.slice(0, 15),
            routePoints: route.overview_path.map(p => ({
              lat: typeof p.lat === "function" ? p.lat() : p.lat,
              lng: typeof p.lng === "function" ? p.lng() : p.lng,
            })),
            vehicleType: vehicle,
            timingMode,
            arriveBy: timingMode === "arrive_by" ? arriveByDate : null,
            scenic,
            truckSafe: isTruckVehicle(vehicle),
            rvSafe: isRvVehicle(vehicle),
            truckHeight: answers.truck_height,
            truckWeight: answers.truck_weight,
            truckHazmat: answers.truck_hazmat,
            rvHeight: answers.rv_height,
            rvWeight: answers.rv_weight,
            rvTowing: answers.rv_towing,
          };
          setRouteInfo(nextRouteInfo);
          setOrigin(originVal);
          setDest(destVal);
          setRoutePath(route.overview_path);
          setTruckRoutePath(null);
          setDirectionsResult(result);

          setCachedDirections(signature, buildDirectionsCacheEntry(result, {
            originVal,
            destVal,
            routeInfoExtras: {
              vehicleType: vehicle,
              timingMode,
              arriveBy: timingMode === "arrive_by" ? arriveByDate : null,
              scenic,
              truckSafe: isTruckVehicle(vehicle),
              rvSafe: isRvVehicle(vehicle),
              truckHeight: answers.truck_height,
              truckWeight: answers.truck_weight,
              truckHazmat: answers.truck_hazmat,
              rvHeight: answers.rv_height,
              rvWeight: answers.rv_weight,
              rvTowing: answers.rv_towing,
            },
          }));

          scheduleFitBounds(nextRouteInfo.routePoints, 60);
          resolve({ ok: true, routeInfo: nextRouteInfo });
        } else {
          const msg = status === "ZERO_RESULTS"
            ? "No driving route found between these places."
            : status === "NOT_FOUND"
              ? "Could not find one or both addresses."
              : "Could not calculate route. Check addresses and try again.";
          setRouteError(msg);
          setRouteInfo(null);
          setRoutePath(null);
          setTruckRoutePath(null);
          setDirectionsResult(null);
          toastFnRef.current?.(msg, { duration: 7000 });
          resolve({ ok: false });
        }
      });
    });
    directionsFetchRef.current = { key: requestKey, promise };
    promise.finally(() => {
      if (directionsFetchRef.current?.key === requestKey) {
        directionsFetchRef.current = null;
      }
    });
    return promise;
  }, [timingMode, arriveByDate, answers, origin, dest, setOrigin, setDest, toastFnRef, scheduleFitBounds]);

  const fetchRouteBetween = useCallback((originVal, destVal, { skipFitBounds = false } = {}) => {
    if (!originVal || !destVal || !window.google) return Promise.resolve(false);

    const signature = buildRouteSignature({ origin: originVal, destination: destVal });
    const cached = getCachedDirections(signature);
    if (cached) {
      setRouteInfo(cached.routeInfo);
      setRoutePath(cached.routePath);
      setDirectionsResult(cached.directionsResult);
      if (!skipFitBounds) scheduleFitBounds(cached.routePoints, 60);
      return Promise.resolve(true);
    }

    setRouteLoading(true);
    setTrafficAlert(false);

    const routeRequest = {
      origin: originVal,
      destination: destVal,
      travelMode: window.google.maps.TravelMode.DRIVING,
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: window.google.maps.TrafficModel.BEST_GUESS,
      },
    };

    const service = new window.google.maps.DirectionsService();
    return new Promise((resolve) => {
      service.route(routeRequest, (result, status) => {
        setRouteLoading(false);
        if (status === "OK") {
          const route = result.routes[0];
          const leg = route.legs[0];
          const routeInfo = {
            distance: leg.distance.text,
            duration: leg.duration.text,
            start: leg.start_address.split(",")[0],
            end: leg.end_address.split(",")[0],
            origin: originVal,
            destination: destVal,
            originLat: typeof leg.start_location.lat === "function" ? leg.start_location.lat() : leg.start_location.lat,
            originLng: typeof leg.start_location.lng === "function" ? leg.start_location.lng() : leg.start_location.lng,
            destLat: typeof leg.end_location.lat === "function" ? leg.end_location.lat() : leg.end_location.lat,
            destLng: typeof leg.end_location.lng === "function" ? leg.end_location.lng() : leg.end_location.lng,
            routePoints: route.overview_path.map(p => ({
              lat: typeof p.lat === "function" ? p.lat() : p.lat,
              lng: typeof p.lng === "function" ? p.lng() : p.lng,
            })),
            vehicleType: "Car",
            timingMode: "leave_now",
          };
          setRouteInfo(routeInfo);
          setRoutePath(route.overview_path);
          setDirectionsResult(result);
          setCachedDirections(signature, buildDirectionsCacheEntry(result, {
            originVal,
            destVal,
            routeInfoExtras: { vehicleType: "Car", timingMode: "leave_now" },
          }));
          if (!skipFitBounds) scheduleFitBounds(routeInfo.routePoints, 60);
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }, [scheduleFitBounds]);

  function highlightStop(stopId) {
    if (!stopId) return;
    setHighlightedStopId(stopId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedStopId(null), 2000);
  }

  function handleMapMarkerSelect(marker) {
    if (!marker?.id) return;
    const stopId = marker.waypointId || marker.id;
    if (generated && itinerarySyncRef.current?.itineraryWaypoints?.length) {
      itinerarySyncRef.current?.handleMarkerSelect(marker);
      highlightStop(stopId);
      return;
    }
    let legacyId = stopId;
    if (legacyId.startsWith("stop-")) {
      legacyId = `overnight-${legacyId.replace("stop-", "")}`;
    }
    highlightStop(legacyId);
  }

  const recenterMap = useCallback(() => {
    if (!window.google) return;
    const points = [];

    if (directionsResult?.routes?.[0]?.legs) {
      directionsResult.routes[0].legs.forEach((leg) => {
        leg.steps.forEach((step) => {
          const start = normalizeMapPoint(step.start_location);
          const end = normalizeMapPoint(step.end_location);
          if (start) points.push(start);
          if (end) points.push(end);
        });
      });
    } else if (truckRoutePath?.length) {
      truckRoutePath.forEach((p) => {
        const pt = normalizeMapPoint(p);
        if (pt) points.push(pt);
      });
    } else if (routePath?.length) {
      routePath.forEach((p) => {
        const pt = normalizeMapPoint(p);
        if (pt) points.push(pt);
      });
    } else if (routeInfo?.routePoints?.length) {
      routeInfo.routePoints.forEach((p) => {
        const pt = normalizeMapPoint(p);
        if (pt) points.push(pt);
      });
    }

    mapMarkers.forEach((m) => {
      if (m?.lat != null && m?.lng != null) {
        points.push({ lat: m.lat, lng: m.lng });
      }
    });

    if (points.length >= 2) scheduleFitBounds(points, 60);
  }, [routeInfo, routePath, truckRoutePath, directionsResult, mapMarkers, normalizeMapPoint, scheduleFitBounds]);

  const flushMapLayout = useCallback(() => {
    requestAnimationFrame(() => {
      if (!mapRef.current || !window.google) return;
      window.google.maps.event.trigger(mapRef.current, "resize");
      recenterMap();
    });
  }, [recenterMap]);

  useEffect(() => () => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
  }, []);

  useEffect(() => {
    if (view !== "app" || !isLoaded || !mapReady || !window.google) return;
    const o = origin?.trim();
    const d = dest?.trim();
    if (!o || !d) return;
    if (routeInfo?.origin === o && routeInfo?.destination === d && routePath) return;
    fetchDirections();
  }, [view, isLoaded, mapReady, origin, dest, routeInfo?.origin, routeInfo?.destination, routePath, fetchDirections]);

  useEffect(() => {
    if (!mapRef.current || !mapReady || !window.google) return;
    window.google.maps.event.trigger(mapRef.current, "resize");
    recenterMap();
  }, [mapReady, generated, directionsResult, routePath, routeInfo?.routePoints, recenterMap]);

  useEffect(() => {
    if (!isLoaded || !window.google) return;
    if (!originRef.current?.value || !destRef.current?.value) return;
    if (answers.vehicle) fetchDirections(answers.vehicle);
  }, [answers.preferences, answers.truck_height, answers.truck_weight, answers.rv_height, answers.rv_weight, answers.rv_towing, answers.vehicle, isLoaded, fetchDirections]);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    const typeId = mapStyle === "satellite"
      ? window.google.maps.MapTypeId.SATELLITE
      : window.google.maps.MapTypeId.ROADMAP;
    mapRef.current.setMapTypeId(typeId);
    if (mapStyle === "satellite") {
      mapRef.current.setOptions({ styles: [], backgroundColor: undefined });
    } else {
      applyMapThemeStyles(mapRef.current, mapStyle, theme);
    }
  }, [mapStyle, theme, isLoaded, mapReady]);

  useEffect(() => {
    if (!mapRef.current || !window.google || !isLoaded || !mapReady) return;
    if (polylineAnimRef.current) {
      clearInterval(polylineAnimRef.current);
      polylineAnimRef.current = null;
    }
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }

    const bounds = new window.google.maps.LatLngBounds();
    let hasBounds = false;
    const fitPoints = [];
    const ROUTE_GOLD = TRIP_ROUTE_GOLD;

    const drawLine = (path, style) => {
      if (!path?.length) return;
      const color = style.dashed ? (style.color || TRIP_ROUTE_GOLD) : TRIP_ROUTE_GOLD;
      const opts = {
        path,
        geodesic: true,
        strokeColor: color,
        strokeOpacity: style.dashed ? 0 : 0.9,
        strokeWeight: 5,
        map: mapRef.current,
      };
      if (style.dashed) {
        opts.strokeOpacity = 0;
        opts.icons = [{
          icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: color, scale: 3 },
          offset: "0",
          repeat: "16px",
        }];
      } else if (style.animate !== false) {
        opts.strokeOpacity = 0;
        opts.icons = [{
          icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: color, scale: 4 },
          offset: "0",
          repeat: "24px",
        }];
      }
      const pl = new window.google.maps.Polyline(opts);
      polylinesRef.current.push(pl);
      path.forEach((pt) => {
        const normalized = normalizeMapPoint(pt);
        if (normalized) {
          bounds.extend(normalized);
          fitPoints.push(normalized);
          hasBounds = true;
        }
      });
    };

    if (tripLegs.length > 0) {
      tripLegs.forEach(leg => {
        if (!leg.path) return;
        drawLine(leg.path, LEG_MAP_STYLES[leg.type] || LEG_MAP_STYLES.drive);
      });
    } else if (truckRoutePath?.length) {
      drawLine(truckRoutePath, { color: ROUTE_GOLD, dashed: false, animate: true });
    } else if (routePath && !directionsResult) {
      drawLine(routePath, { color: ROUTE_GOLD, dashed: false, animate: true });
    }

    if (hasBounds) scheduleFitBounds(fitPoints, 60);

    let dashOffset = 0;
    polylineAnimRef.current = setInterval(() => {
      dashOffset = (dashOffset + 2) % 48;
      polylinesRef.current.forEach(pl => {
        const icons = pl.get("icons");
        if (!icons?.length) return;
        pl.set("icons", icons.map((ic, i) => (i === 0 ? { ...ic, offset: `${dashOffset}px` } : ic)));
      });
    }, 50);

    return () => {
      if (polylineAnimRef.current) {
        clearInterval(polylineAnimRef.current);
        polylineAnimRef.current = null;
      }
    };
  }, [tripLegs, routePath, truckRoutePath, directionsResult, isLoaded, mapReady, theme, routeInfo?.scenic, normalizeMapPoint, scheduleFitBounds]);

  function clearExploreRange() {
    exploreRangeAbortRef.current?.abort();
    exploreRangeAbortRef.current = null;
    setExploreRangePolygon([]);
    setExploreRangeLoading(false);
    setExploreRangeError(null);
    setExploreCorridorPath([]);
    setExploreCorridorStops([]);
    setExploreStatusMessage(null);
    setExploreOriginCoords(null);
    setExploreFromCoords(null);
  }

  useEffect(() => {
    if (!exploreRangeEnabled) {
      clearExploreRange();
    }
  }, [exploreRangeEnabled]);

  function handleExploreRangeToggle(enabled) {
    setExploreRangeEnabled(enabled);
    if (!enabled) clearExploreRange();
  }

  function handleExploreRangeDriveTimeChange(seconds) {
    setExploreRangeDriveSeconds(seconds);
  }

  const focusMapOnStop = useCallback((item) => {
    if (item?.lat == null || item?.lng == null) return;
    setMapFocusTarget({
      id: item.id || `focus-${item.lat}-${item.lng}`,
      lat: item.lat,
      lng: item.lng,
      category: item.type === "overnight" ? "lodging" : "poi",
      title: item.title || item.name,
      subtitle: item.city || item.description || "",
      _ts: Date.now(),
    });
  }, []);

  const getDepartureTime = useCallback(() => {
    if (timingMode === "leave_now") return new Date();
    if (timingMode === "arrive_by" && arriveByDate && routeInfo?.duration) {
      const hours = parseHoursFromDuration(routeInfo.duration);
      const arrive = new Date(arriveByDate);
      if (!Number.isNaN(arrive.getTime()) && hours) {
        return new Date(arrive.getTime() - hours * 3600000);
      }
    }
    return new Date();
  }, [timingMode, arriveByDate, routeInfo]);

  const routeSegmentKey = routeInfo?.routePoints?.length
    ? `${routeInfo.origin}|${routeInfo.destination}|${routeInfo.distance}`
    : null;

  const computedSegmentPaths = useMemo(() => {
    if (!routeInfo?.routePoints?.length) {
      return { nightSegmentPaths: [], lowFuelSegmentPaths: [] };
    }
    const hours = parseHoursFromDuration(routeInfo.duration);
    const dep = getDepartureTime();
    const nightBlocks = computeNightDrivingBlocks(dep, hours, routeInfo.routePoints);
    const totalMiles = parseMilesFromDistance(routeInfo.distance);
    return {
      nightSegmentPaths: nightBlocks.flatMap(b => (b.path?.length > 1 ? [b.path] : [])),
      lowFuelSegmentPaths: computeLowFuelSegmentPath(
        routeInfo.routePoints,
        [],
        getFuelRangeMiles(answers),
        totalMiles,
      ),
    };
  }, [routeInfo, answers, getDepartureTime]);

  const segmentsForcedEmpty = segmentsEmptyForRoute === routeSegmentKey && routeSegmentKey != null;
  const nightSegmentPaths = segmentsForcedEmpty ? [] : computedSegmentPaths.nightSegmentPaths;
  const lowFuelSegmentPaths = segmentsForcedEmpty ? [] : computedSegmentPaths.lowFuelSegmentPaths;

  const setNightSegmentPaths = useCallback((paths) => {
    if (Array.isArray(paths) && paths.length === 0 && routeSegmentKey) {
      setSegmentsEmptyForRoute(routeSegmentKey);
    }
  }, [routeSegmentKey]);

  const setLowFuelSegmentPaths = useCallback((paths) => {
    if (Array.isArray(paths) && paths.length === 0 && routeSegmentKey) {
      setSegmentsEmptyForRoute(routeSegmentKey);
    }
  }, [routeSegmentKey]);

  return {
    isLoaded,
    exploreRangeEnabled,
    setExploreRangeEnabled,
    exploreRangeDriveSeconds,
    setExploreRangeDriveSeconds,
    exploreRangePolygon,
    setExploreRangePolygon,
    exploreRangeLoading,
    setExploreRangeLoading,
    exploreRangeError,
    setExploreRangeError,
    exploreOriginCoords,
    setExploreOriginCoords,
    exploreSearchQuery,
    setExploreSearchQuery,
    exploreRangeAbortRef,
    exploreCorridorPath,
    setExploreCorridorPath,
    exploreCorridorStops,
    setExploreCorridorStops,
    exploreStatusMessage,
    setExploreStatusMessage,
    exploreFromCoords,
    setExploreFromCoords,
    mapStyle,
    setMapStyle,
    mapStyleOpen,
    setMapStyleOpen,
    trafficAlert,
    setTrafficAlert,
    mapMarkers,
    setMapMarkers,
    nightSegmentPaths,
    setNightSegmentPaths,
    lowFuelSegmentPaths,
    setLowFuelSegmentPaths,
    activeDayIndex,
    setActiveDayIndex,
    mapFocusTarget,
    setMapFocusTarget,
    highlightedStopId,
    setHighlightedStopId,
    routeError,
    setRouteError,
    highlightTimerRef,
    routeInfo,
    setRouteInfo,
    routePath,
    setRoutePath,
    truckRoutePath,
    setTruckRoutePath,
    directionsResult,
    setDirectionsResult,
    routeLoading,
    setRouteLoading,
    mapCenter,
    originRef,
    destRef,
    heroOriginRef,
    heroDestRef,
    heroOriginAcRef,
    heroDestAcRef,
    navigateOriginRef,
    navigateDestRef,
    mapRef,
    polylineRef,
    polylinesRef,
    polylineAnimRef,
    mapReady,
    setMapReady,
    fetchDirections,
    fetchRouteBetween,
    highlightStop,
    handleMapMarkerSelect,
    recenterMap,
    clearExploreRange,
    handleExploreRangeToggle,
    handleExploreRangeDriveTimeChange,
    focusMapOnStop,
    getDepartureTime,
    flushMapLayout,
    flushPendingFitBounds,
  };
}
