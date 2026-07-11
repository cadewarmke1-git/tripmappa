/** Full-screen Google Map with live trip markers, route highlights, and info cards. */
import { useState, useEffect, useMemo, useRef } from "react";
import GoldSpinner from "./GoldSpinner.jsx";
import { GoogleMap, DirectionsRenderer } from "@react-google-maps/api";
import MapRoutePill from "./MapRoutePill.jsx";
import MapMarkerLayer from "./map/MapMarkerLayer.jsx";
import MapInfoCard from "./map/MapInfoCard.jsx";
import MapRouteOverlays from "./map/MapRouteOverlays.jsx";
import MapGenerationPulse from "./map/MapGenerationPulse.jsx";
import MapRecenterButton from "./map/MapRecenterButton.jsx";
import MapZoomControls from "./map/MapZoomControls.jsx";
import MapBackToTripButton from "./map/MapBackToTripButton.jsx";
import AnimatedRoutePath from "./map/AnimatedRoutePath.jsx";
import HighlightRouteLeg from "./map/HighlightRouteLeg.jsx";
import NavigationCarMarker from "./map/NavigationCarMarker.jsx";
import { getDirectionsPath } from "../lib/mapRoutePath.js";
import { getRouteMapViewport } from "../lib/mapViewport.js";
import { DARK_MAP_STYLES } from "../lib/constants.js";

/** Warm road-trip atlas — sandy terrain, grey water, orange-brown highways. Same for day & night. */
const TRIPMAPPA_WARM_MAP_STYLES = [
  { elementType: "labels", stylers: [{ visibility: "simplified" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.medical", stylers: [{ visibility: "off" }] },
  { featureType: "poi.school", stylers: [{ visibility: "off" }] },
  { featureType: "poi.government", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { elementType: "geometry", stylers: [{ color: "#EDE4D0" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#EDE4D0" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#E8DCC4" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#EDE4D0" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6B5744" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#EDE4D0" }, { weight: 2 }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#C4B8A8" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#4A3828" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#DDD0B4" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6B5744" }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#D9CEB8" }] },
  { featureType: "road.local", elementType: "geometry.stroke", stylers: [{ color: "#C4B8A8" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#CDB896" }] },
  { featureType: "road.arterial", elementType: "geometry.stroke", stylers: [{ color: "#B8A888" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#B87333" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#8B5A2B" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6B5744" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#4A3828" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#A8A49C" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#7A756E" }] },
];

const TRIPMAPPA_WARM_MAP_BACKGROUND = "#EDE4D0";
const TRIPMAPPA_DARK_MAP_BACKGROUND = "#15120C";

function resolveRoadmapStyles(mapStyle) {
  if (mapStyle === "satellite") return [];
  if (mapStyle === "dark") return DARK_MAP_STYLES;
  return TRIPMAPPA_WARM_MAP_STYLES;
}

function resolveRoadmapBackground(mapStyle) {
  if (mapStyle === "satellite") return undefined;
  if (mapStyle === "dark") return TRIPMAPPA_DARK_MAP_BACKGROUND;
  return TRIPMAPPA_WARM_MAP_BACKGROUND;
}

function applyRoadmapOptions(map, mapStyle) {
  if (!map?.setOptions) return;
  map.setOptions({
    styles: resolveRoadmapStyles(mapStyle),
    ...(resolveRoadmapBackground(mapStyle) ? { backgroundColor: resolveRoadmapBackground(mapStyle) } : { backgroundColor: undefined }),
  });
}

export const DEFAULT_APP_MAP_DISPLAY = {
  isLoaded: false,
  isDarkMode: false,
  showRoutePill: true,
  showNavigationCar: false,
};

export default function AppMap({
  display: displayProp = {},
  mapCenter,
  mapStyle,
  mapStyleOpen,
  trafficAlert,
  onDismissTrafficAlert = null,
  routeLoading,
  tripGenerating = false,
  mapRef,
  directions,
  routeInfo,
  routePoints = [],
  answers,
  mapMarkers = [],
  dismissedAlertIds = [],
  dayRoutePaths = [],
  activeDayIndex = null,
  nightSegmentPaths = [],
  lowFuelSegmentPaths = [],
  mapFocusTarget = null,
  onMapReady,
  onMapUnmount,
  onFlushPendingFitBounds = null,
  onMapStyleOpenChange,
  onMapStyleChange,
  onMarkerAction,
  onMarkerSelect,
  onRecenter,
  onBackToResults = null,
  theme: themeProp,
  onNavigateHome = null,
  navigateHomePending = false,
  onMapBackgroundClick = null,
  truckRoutePath = null,
  highlightedLegPath = [],
  inAppNavigationOnly = false,
  routeFocusMode = false,
}) {
  const {
    isLoaded,
    isDarkMode,
    showRoutePill,
    showNavigationCar,
  } = { ...DEFAULT_APP_MAP_DISPLAY, ...displayProp };
  const theme = themeProp ?? "night";
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [mapHostReady, setMapHostReady] = useState(false);
  const mapHostRef = useRef(null);
  const suppressMapClearRef = useRef(false);
  const directionsPath = useMemo(() => getDirectionsPath(directions), [directions]);
  const activeRoutePath = useMemo(() => {
    if (truckRoutePath?.length > 1) return truckRoutePath;
    if (directionsPath?.length > 1) return directionsPath;
    if (routePoints?.length > 1) return routePoints;
    if (routeInfo?.routePoints?.length > 1) return routeInfo.routePoints;
    return [];
  }, [truckRoutePath, directionsPath, routePoints, routeInfo?.routePoints]);
  const mapStyles = useMemo(() => resolveRoadmapStyles(mapStyle), [mapStyle]);
  const routeViewport = useMemo(() => getRouteMapViewport(activeRoutePath), [activeRoutePath]);
  const mapBackgroundColor = useMemo(() => resolveRoadmapBackground(mapStyle), [mapStyle]);
  const bootViewportRef = useRef(null);
  if (!mapInstance) {
    bootViewportRef.current = routeViewport ?? { center: mapCenter, zoom: 4 };
  }
  const initialCenter = bootViewportRef.current?.center ?? mapCenter;
  const initialZoom = bootViewportRef.current?.zoom ?? 4;
  const mapOptions = useMemo(() => ({
    disableDefaultUI: false,
    zoomControl: false,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
    keyboardShortcuts: false,
    mapTypeId: mapStyle === "satellite" ? "satellite" : "roadmap",
    styles: mapStyles,
    ...(mapBackgroundColor ? { backgroundColor: mapBackgroundColor } : {}),
  }), [mapStyle, mapStyles, mapBackgroundColor]);

  useEffect(() => {
    const host = mapHostRef.current;
    if (!host || !isLoaded) {
      setMapHostReady(false);
      return undefined;
    }

    const syncHostReady = () => {
      const { width, height } = host.getBoundingClientRect();
      setMapHostReady(width > 0 && height > 0);
    };

    syncHostReady();
    const observer = new ResizeObserver(syncHostReady);
    observer.observe(host);
    return () => observer.disconnect();
  }, [isLoaded]);

  useEffect(() => {
    if (!mapInstance || !window.google?.maps) return;
    const typeId = mapStyle === "satellite"
      ? window.google.maps.MapTypeId.SATELLITE
      : window.google.maps.MapTypeId.ROADMAP;
    mapInstance.setMapTypeId(typeId);
    applyRoadmapOptions(mapInstance, mapStyle);
    window.google.maps.event.trigger(mapInstance, "resize");
  }, [mapInstance, mapStyle]);

  useEffect(() => {
    if (!mapInstance || !window.google?.maps) return undefined;
    const host = mapHostRef.current;
    if (!host) return undefined;

    const observer = new ResizeObserver(() => {
      window.google.maps.event.trigger(mapInstance, "resize");
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [mapInstance]);

  function handleMapLoad(map) {
    mapRef.current = map;
    setMapInstance(map);
    applyRoadmapOptions(map, mapStyle);
    if (window.google?.maps) {
      window.google.maps.event.trigger(map, "resize");
      onFlushPendingFitBounds?.();
      if (activeRoutePath.length >= 2) {
        const bounds = new window.google.maps.LatLngBounds();
        activeRoutePath.forEach((point) => {
          if (point?.lat != null && point?.lng != null) bounds.extend(point);
        });
        map.fitBounds(bounds, { padding: 72 });
      }
    }
    onMapReady?.();
  }

  function handleMapUnmount() {
    mapRef.current = null;
    setMapInstance(null);
    onMapUnmount?.();
  }

  useEffect(() => {
    if (!mapInstance || !window.google?.maps || activeRoutePath.length < 2) return undefined;

    let cancelled = false;
    const fitRoute = () => {
      if (cancelled || !mapInstance || !window.google?.maps) return;
      const bounds = new window.google.maps.LatLngBounds();
      activeRoutePath.forEach((point) => {
        if (point?.lat != null && point?.lng != null) bounds.extend(point);
      });
      mapMarkers.forEach((marker) => {
        if (marker?.lat != null && marker?.lng != null) {
          bounds.extend({ lat: marker.lat, lng: marker.lng });
        }
      });
      window.google.maps.event.trigger(mapInstance, "resize");
      mapInstance.fitBounds(bounds, { padding: 72 });
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(fitRoute);
    });

    const listener = window.google.maps.event.addListenerOnce(mapInstance, "idle", () => {
      const zoom = mapInstance.getZoom?.();
      if (typeof zoom === "number" && zoom > 12) mapInstance.setZoom(12);
    });

    return () => {
      cancelled = true;
      if (listener) window.google.maps.event.removeListener(listener);
    };
  }, [mapInstance, activeRoutePath, mapMarkers]);

  useEffect(() => {
    if (!mapFocusTarget?.lat || !mapRef.current || !window.google) return;
    mapRef.current.panTo({ lat: mapFocusTarget.lat, lng: mapFocusTarget.lng });
    const zoom = mapRef.current.getZoom?.() ?? 4;
    if (zoom < 10) mapRef.current.setZoom(11);
    setSelectedMarker(mapFocusTarget);
  }, [mapFocusTarget, mapRef]);

  function handleMarkerClick(marker) {
    suppressMapClearRef.current = true;
    setSelectedMarker(marker);
    onMarkerSelect?.(marker);
  }

  function handleInfoAction(action, marker) {
    onMarkerAction?.(action, marker);
  }

  const pulsePoints = routePoints.length > 1
    ? routePoints
    : (routeInfo?.routePoints || []);

  return (
    <>
    <div ref={mapHostRef} className={`map-full${routeFocusMode ? " map-full-route-focus" : ""}`}>
      {isLoaded && mapHostReady ? (
        <>
          <GoogleMap
            mapContainerClassName="gmap-wrap"
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={initialCenter}
            zoom={initialZoom}
            onLoad={handleMapLoad}
            onUnmount={handleMapUnmount}
            options={mapOptions}
            onClick={() => {
              if (suppressMapClearRef.current) {
                suppressMapClearRef.current = false;
                return;
              }
              setSelectedMarker(null);
              onMapBackgroundClick?.();
            }}
          >
            {directions && !truckRoutePath?.length && (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: true,
                  suppressPolylines: true,
                }}
              />
            )}
            {activeRoutePath.length > 1 && (
              <AnimatedRoutePath path={activeRoutePath} />
            )}
            <NavigationCarMarker
              path={activeRoutePath}
              visible={showNavigationCar || routeFocusMode}
            />
            {highlightedLegPath.length > 1 && (
              <HighlightRouteLeg path={highlightedLegPath} />
            )}
            <MapMarkerLayer
              markers={mapMarkers}
              isDarkMode={isDarkMode}
              dismissedAlertIds={dismissedAlertIds}
              onMarkerClick={handleMarkerClick}
            />
            <MapRouteOverlays
              dayRoutePaths={directions ? [] : dayRoutePaths}
              activeDayIndex={activeDayIndex}
              nightSegmentPaths={nightSegmentPaths}
              lowFuelSegmentPaths={lowFuelSegmentPaths}
            />
          </GoogleMap>
          <MapGenerationPulse mapRef={mapRef} routePoints={pulsePoints} active={tripGenerating} />
          {trafficAlert && (
            <div className="traffic-toast" role="status" aria-live="polite">
              <span className="traffic-toast-icon">!</span>
              <span>Traffic delays detected on your route</span>
              {onDismissTrafficAlert && (
                <button type="button" className="traffic-toast-dismiss" onClick={onDismissTrafficAlert} aria-label="Dismiss traffic alert">
                  ×
                </button>
              )}
            </div>
          )}
          <div className="map-top-controls" aria-label="Map controls">
            <div className="map-style-toggle">
              <button type="button" className="map-style-btn" onClick={() => onMapStyleOpenChange(o => !o)} aria-label="Map style">Map</button>
              {mapStyleOpen && (
                <div className="map-style-menu">
                  {[["standard", "Standard"], ["satellite", "Satellite"], ["dark", "Dark"]].map(([k, l]) => (
                    <button key={k} type="button" className={`map-style-item${mapStyle === k ? " active" : ""}`} onClick={() => { onMapStyleChange(k); onMapStyleOpenChange(false); }}>{l}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="map-controls-stack">
            <MapZoomControls mapRef={mapRef} />
            <MapRecenterButton onRecenter={onRecenter} />
          </div>
          {onBackToResults && (
            <MapBackToTripButton onBack={onBackToResults} />
          )}
        </>
      ) : (
        <div className="map-loading">
          <GoldSpinner size="lg" />
        </div>
      )}
      {isLoaded && routeLoading && !tripGenerating && (
        <div className="route-loading-pill route-loading-pill--loader">
          <GoldSpinner size="md" />
        </div>
      )}
      {showRoutePill && (
        <MapRoutePill
          routeInfo={routeInfo}
          answers={answers}
          tripGenerating={tripGenerating}
          theme={theme}
          onNavigateHome={onNavigateHome}
          navigateHomePending={navigateHomePending}
        />
      )}
    </div>
    {isLoaded && selectedMarker && (
      <MapInfoCard
        marker={selectedMarker}
        theme={theme}
        onClose={() => setSelectedMarker(null)}
        onAction={handleInfoAction}
      />
    )}
    </>
  );
}
