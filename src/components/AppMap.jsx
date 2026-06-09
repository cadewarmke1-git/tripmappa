/** Full-screen Google Map with live trip markers, route highlights, and info cards. */
import { useState, useEffect, useMemo } from "react";
import RouteDrawingLoader from "./RouteDrawingLoader.jsx";
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
import { getDirectionsPath } from "../lib/mapRoutePath.js";
import { resolveMapStyles, applyMapThemeStyles } from "../lib/mapStyles.js";

export default function AppMap({
  isLoaded,
  mapCenter,
  mapStyle,
  mapStyleOpen,
  trafficAlert,
  onDismissTrafficAlert = null,
  routeLoading,
  tripGenerating = false,
  isDarkMode,
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
  onMapStyleOpenChange,
  onMapStyleChange,
  onMarkerAction,
  onMarkerSelect,
  onRecenter,
  onBackToResults = null,
  theme: themeProp,
  onNavigateHome = null,
  navigateHomePending = false,
  showRoutePill = true,
  onMapBackgroundClick = null,
  truckRoutePath = null,
}) {
  const theme = themeProp ?? "night";
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const directionsPath = useMemo(() => getDirectionsPath(directions), [directions]);
  const activeRoutePath = useMemo(() => {
    if (truckRoutePath?.length > 1) return truckRoutePath;
    return directionsPath;
  }, [truckRoutePath, directionsPath]);
  const mapStyles = useMemo(() => resolveMapStyles(mapStyle, theme), [mapStyle, theme]);
  const mapOptions = useMemo(() => ({
    disableDefaultUI: false,
    zoomControl: false,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
    keyboardShortcuts: false,
    mapTypeId: mapStyle === "satellite" ? "satellite" : "roadmap",
    styles: mapStyles,
  }), [mapStyle, mapStyles]);

  useEffect(() => {
    if (!mapInstance || !window.google?.maps) return;
    const typeId = mapStyle === "satellite"
      ? window.google.maps.MapTypeId.SATELLITE
      : window.google.maps.MapTypeId.ROADMAP;
    mapInstance.setMapTypeId(typeId);
    applyMapThemeStyles(mapInstance, mapStyle, theme);
  }, [mapInstance, mapStyle, theme]);

  function handleMapLoad(map) {
    mapRef.current = map;
    setMapInstance(map);
    applyMapThemeStyles(map, mapStyle, theme);
    onMapReady?.();
  }

  function handleMapUnmount() {
    mapRef.current = null;
    setMapInstance(null);
    onMapUnmount?.();
  }

  useEffect(() => {
    if (!mapFocusTarget?.lat || !mapRef.current || !window.google) return;
    mapRef.current.panTo({ lat: mapFocusTarget.lat, lng: mapFocusTarget.lng });
    const zoom = mapRef.current.getZoom?.() ?? 4;
    if (zoom < 10) mapRef.current.setZoom(11);
    setSelectedMarker(mapFocusTarget);
  }, [mapFocusTarget, mapRef]);

  function handleMarkerClick(marker) {
    setSelectedMarker(marker);
    onMarkerSelect?.(marker);
  }

  function handleInfoAction(action, marker) {
    onMarkerAction?.(action, marker);
    if (action === "directions" && marker.lat != null && marker.lng != null) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${marker.lat},${marker.lng}`, "_blank");
    }
  }

  const pulsePoints = routePoints.length > 1
    ? routePoints
    : (routeInfo?.routePoints || []);

  return (
    <div className="map-full">
      {isLoaded ? (
        <>
          <GoogleMap
            mapContainerClassName="gmap-wrap"
            center={mapCenter}
            zoom={4}
            onLoad={handleMapLoad}
            onUnmount={handleMapUnmount}
            options={mapOptions}
            onClick={() => {
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
          {selectedMarker && (
            <MapInfoCard
              marker={selectedMarker}
              theme={theme}
              onClose={() => setSelectedMarker(null)}
              onAction={handleInfoAction}
            />
          )}
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
          <RouteDrawingLoader theme={theme} variant="inline" />
        </div>
      )}
      {isLoaded && routeLoading && !tripGenerating && (
        <div className="route-loading-pill route-loading-pill--loader">
          <RouteDrawingLoader theme={theme} variant="compact" />
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
  );
}
