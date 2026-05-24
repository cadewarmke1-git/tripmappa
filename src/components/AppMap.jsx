/** Full-screen Google Map. Night theme uses Apple Maps–style dark styles via isDarkMode. */
import { GoogleMap } from "@react-google-maps/api";

const DARK_MODE_MAP_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
];

export default function AppMap({
  isLoaded,
  mapCenter,
  mapStyle,
  mapStyleOpen,
  trafficAlert,
  routeLoading,
  isDarkMode,
  mapRef,
  polylinesRef,
  polylineRef,
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
              polylinesRef.current.forEach(p => p.setMap(null));
              polylinesRef.current = [];
              if (polylineRef.current) polylineRef.current.setMap(null);
            }}
            options={{
              disableDefaultUI: false,
              zoomControl: true,
              zoomControlOptions: { position: window.google?.maps?.ControlPosition?.RIGHT_CENTER },
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
              mapTypeId: mapStyle === "satellite" ? "satellite" : "roadmap",
              styles: isDarkMode ? DARK_MODE_MAP_STYLES : [],
            }}
          />
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
