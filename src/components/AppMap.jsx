/** Full-screen Google Map with live trip markers, route highlights, and info cards. */
import { useState, useEffect, useMemo } from "react";
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
import { resolveMapStyles } from "../lib/mapStyles.js";

export default function AppMap({
  isLoaded,
  mapCenter,
  mapStyle,
  mapStyleOpen,
  trafficAlert,
  onDismissTrafficAlert = null,
  routeLoading,
  tripGenerating = false,
  loadingMessageIndex = 0,
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
  onMapStyleOpenChange,
  onMapStyleChange,
  onMarkerAction,
  onMarkerSelect,
  onRecenter,
  onBackToResults = null,
  theme = "night",
  onNavigateHome = null,
  navigateHomePending = false,
  showRoutePill = true,
}) {
  const [selectedMarker, setSelectedMarker] = useState(null);
  const directionsPath = useMemo(() => getDirectionsPath(directions), [directions]);
  const mapStyles = useMemo(() => resolveMapStyles(mapStyle, theme), [mapStyle, theme]);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    const typeId = mapStyle === "satellite"
      ? window.google.maps.MapTypeId.SATELLITE
      : window.google.maps.MapTypeId.ROADMAP;
    mapRef.current.setMapTypeId(typeId);
    mapRef.current.setOptions({ styles: mapStyles });
  }, [mapStyle, theme, mapStyles, mapRef, isLoaded]);

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
            onLoad={map => {
              mapRef.current = map;
              onMapReady?.();
            }}
            options={{
              disableDefaultUI: false,
              zoomControl: false,
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
              mapTypeId: mapStyle === "satellite" ? "satellite" : "roadmap",
              styles: mapStyles,
            }}
            onClick={() => setSelectedMarker(null)}
          >
            {directions && (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: true,
                  suppressPolylines: true,
                }}
              />
            )}
            {directionsPath.length > 1 && (
              <AnimatedRoutePath path={directionsPath} />
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
          <div className="loading-spinner"/>
          <div className="map-placeholder-text">Loading map…</div>
          <div className="map-placeholder-sub">Connecting to Google Maps</div>
        </div>
      )}
      {isLoaded && routeLoading && !tripGenerating && (
        <div className="route-loading-pill">
          Calculating route…
        </div>
      )}
      {showRoutePill && (
        <MapRoutePill
          routeInfo={routeInfo}
          answers={answers}
          tripGenerating={tripGenerating}
          loadingMessageIndex={loadingMessageIndex}
          onNavigateHome={onNavigateHome}
          navigateHomePending={navigateHomePending}
        />
      )}
    </div>
  );
}
