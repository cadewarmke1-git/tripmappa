/** Full-screen Google Map. Night theme uses Apple Maps–style dark styles via isDarkMode. */
import { GoogleMap, DirectionsRenderer } from "@react-google-maps/api";
import { NIGHT_MAP_STYLES } from "../lib/constants.js";

const ROUTE_POLYLINE_OPTIONS = {
  strokeColor: "#FFD28C",
  strokeWeight: 5,
  strokeOpacity: 0.9,
};

export default function AppMap({
  isLoaded,
  mapCenter,
  mapStyle,
  mapStyleOpen,
  trafficAlert,
  routeLoading,
  isDarkMode,
  mapRef,
  directions,
  onMapReady,
  onMapStyleOpenChange,
  onMapStyleChange,
}) {
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
          </GoogleMap>
          {trafficAlert && (
            <div className="traffic-toast">
              <span className="traffic-toast-icon">⚠</span>
              Traffic delays detected on your route
            </div>
          )}
          <div className="map-style-toggle">
            <button type="button" className="map-style-btn" onClick={() => onMapStyleOpenChange(o => !o)} aria-label="Map style">🗺</button>
            {mapStyleOpen && (
              <div className="map-style-menu">
                {[["standard", "Standard"], ["satellite", "Satellite"], ["dark", "Dark"]].map(([k, l]) => (
                  <button key={k} type="button" className={`map-style-item${mapStyle === k ? " active" : ""}`} onClick={() => { onMapStyleChange(k); onMapStyleOpenChange(false); }}>{l}</button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="map-loading">
          <div className="loading-spinner"/>
          <div className="map-placeholder-text">Loading map…</div>
          <div className="map-placeholder-sub">Connecting to Google Maps</div>
          <div className="map-loading-skeleton" aria-hidden="true">
            <div className="map-skeleton-bar"/>
            <div className="map-skeleton-bar"/>
            <div className="map-skeleton-bar"/>
          </div>
        </div>
      )}
      {isLoaded && routeLoading && (
        <div className="route-loading-pill">
          <span className="spinner-dark"/>
          Calculating route…
        </div>
      )}
    </div>
  );
}
