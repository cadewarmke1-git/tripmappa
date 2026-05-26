/** Full-screen Google Map with live trip markers, route highlights, and info cards. */
import { useState, useEffect } from "react";
import { GoogleMap, DirectionsRenderer } from "@react-google-maps/api";
import { NIGHT_MAP_STYLES, TRIP_ROUTE_GOLD } from "../lib/constants.js";
import MapRoutePill from "./MapRoutePill.jsx";
import MapMarkerLayer from "./map/MapMarkerLayer.jsx";
import MapInfoCard from "./map/MapInfoCard.jsx";
import MapLegend from "./map/MapLegend.jsx";
import MapRouteOverlays from "./map/MapRouteOverlays.jsx";
import MapGenerationPulse from "./map/MapGenerationPulse.jsx";
import MapRecenterButton from "./map/MapRecenterButton.jsx";

const ROUTE_POLYLINE_OPTIONS = {
  strokeColor: TRIP_ROUTE_GOLD,
  strokeWeight: 5,
  strokeOpacity: 0.9,
  zIndex: 10,
};

export default function AppMap({
  isLoaded,
  mapCenter,
  mapStyle,
  mapStyleOpen,
  trafficAlert,
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
  theme = "night",
  navigateHomeSlot = null,
}) {
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [legendOpen, setLegendOpen] = useState(false);

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
              zoomControl: true,
              zoomControlOptions: { position: window.google?.maps?.ControlPosition?.RIGHT_CENTER },
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
              mapTypeId: mapStyle === "satellite" ? "satellite" : "roadmap",
              styles: isDarkMode ? NIGHT_MAP_STYLES : [],
            }}
            onClick={() => setSelectedMarker(null)}
          >
            {directions && (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: true,
                  polylineOptions: ROUTE_POLYLINE_OPTIONS,
                }}
              />
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
          <MapLegend open={legendOpen} onToggle={() => setLegendOpen(o => !o)} isDarkMode={isDarkMode} />
          {trafficAlert && (
            <div className="traffic-toast">
              <span className="traffic-toast-icon">!</span>
              Traffic delays detected on your route
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
          <MapRecenterButton theme={theme} onRecenter={onRecenter} />
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
      {navigateHomeSlot}
      <MapRoutePill
        routeInfo={routeInfo}
        answers={answers}
        tripGenerating={tripGenerating}
        loadingMessageIndex={loadingMessageIndex}
      />
    </div>
  );
}
