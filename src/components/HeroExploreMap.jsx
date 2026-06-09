import { GoogleMap, Polygon, Polyline, Marker } from "@react-google-maps/api";
import { useMemo, useEffect, useRef } from "react";
import { applyMapThemeStyles, resolveMapStyles } from "../lib/mapStyles.js";

const DASH_ICON = {
  path: "M 0,-1 0,1",
  strokeOpacity: 1,
  strokeColor: "#FFD28C",
  scale: 2,
};

export default function HeroExploreMap({
  isLoaded,
  center,
  polygon = [],
  places = [],
  theme = "night",
  onMapClick,
  onPlaceSelect,
}) {
  const mapRef = useRef(null);
  const mapStyles = useMemo(() => resolveMapStyles("standard", theme), [theme]);
  const mapOptions = useMemo(() => ({
    disableDefaultUI: true,
    zoomControl: false,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: false,
    keyboardShortcuts: false,
    gestureHandling: "greedy",
    clickableIcons: false,
    styles: mapStyles,
  }), [mapStyles]);

  const closedPath = useMemo(() => {
    if (polygon.length < 3) return [];
    const first = polygon[0];
    const last = polygon[polygon.length - 1];
    if (first.lat === last.lat && first.lng === last.lng) return polygon;
    return [...polygon, first];
  }, [polygon]);

  useEffect(() => {
    if (!isLoaded || !center || polygon.length < 3) return;
    if (!mapRef.current || !window.google) return;
    const bounds = new window.google.maps.LatLngBounds();
    polygon.forEach(p => bounds.extend(p));
    mapRef.current.fitBounds(bounds, { padding: 48 });
  }, [isLoaded, center, polygon]);

  if (!isLoaded || !center || polygon.length < 3) return null;

  return (
    <div className="hero-explore-map" aria-hidden="false">
      <GoogleMap
        mapContainerClassName="hero-explore-map-canvas"
        center={center}
        zoom={8}
        options={mapOptions}
        onLoad={(map) => {
          mapRef.current = map;
          applyMapThemeStyles(map, "standard", theme);
        }}
        onUnmount={() => { mapRef.current = null; }}
        onClick={(e) => {
          if (!e?.latLng) return;
          onMapClick?.({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        }}
      >
        <Polygon
          paths={polygon}
          options={{
            fillColor: "#FFD28C",
            fillOpacity: 0.12,
            strokeWeight: 0,
            clickable: true,
            zIndex: 1,
          }}
          onClick={(e) => {
            if (!e?.latLng) return;
            onMapClick?.({ lat: e.latLng.lat(), lng: e.latLng.lng() });
          }}
        />
        {closedPath.length > 1 && (
          <Polyline
            path={closedPath}
            options={{
              strokeColor: "#FFD28C",
              strokeWeight: 1.5,
              strokeOpacity: 0,
              clickable: false,
              zIndex: 2,
              icons: [{
                icon: DASH_ICON,
                offset: "0",
                repeat: "12px",
              }],
            }}
          />
        )}
        {places.map(place => (
          <Marker
            key={place.id}
            position={{ lat: place.lat, lng: place.lng }}
            label={{
              text: place.name,
              color: "#FFD28C",
              fontSize: "11px",
              fontWeight: "600",
            }}
            onClick={() => onPlaceSelect?.(place)}
          />
        ))}
      </GoogleMap>
    </div>
  );
}
