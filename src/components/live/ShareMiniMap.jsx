import { useMemo } from "react";
import GoldSpinner from "../GoldSpinner.jsx";
import { GoogleMap, Polyline } from "@react-google-maps/api";
import { TRIP_ROUTE_GOLD } from "../../lib/constants.js";
import { OWNER_COLOR } from "../../lib/convoyConstants.js";
import { resolveMapStyles } from "../../lib/mapStyles.js";
import BreadcrumbPath from "./BreadcrumbPath.jsx";
import ConvoyPin from "./ConvoyPin.jsx";

export default function ShareMiniMap({
  isLoaded,
  latitude,
  longitude,
  routePath = [],
  breadcrumbPath = [],
  convoyMembers = [],
  ownerName = "You",
  followerCount = 0,
  theme = "night",
}) {
  const center = useMemo(() => {
    if (latitude != null && longitude != null) {
      return { lat: latitude, lng: longitude };
    }
    if (routePath.length) return routePath[Math.floor(routePath.length / 2)];
    return { lat: 39.8283, lng: -98.5795 };
  }, [latitude, longitude, routePath]);

  const mapStyles = useMemo(() => resolveMapStyles("standard", theme), [theme]);

  if (!isLoaded) {
    return (
      <div className="share-mini-map share-mini-map-loading">
        <GoldSpinner size="md" />
      </div>
    );
  }

  return (
    <div className="share-mini-map">
      <GoogleMap
        mapContainerClassName="share-mini-map-inner"
        center={center}
        zoom={latitude != null ? 8 : 4}
        options={{
          disableDefaultUI: true,
          zoomControl: false,
          draggable: true,
          scrollwheel: false,
          gestureHandling: "cooperative",
          styles: mapStyles,
        }}
      >
        <BreadcrumbPath breadcrumbs={breadcrumbPath} />
        {routePath.length > 1 && (
          <Polyline
            path={routePath}
            options={{
              strokeColor: TRIP_ROUTE_GOLD,
              strokeWeight: 4,
              strokeOpacity: 0.7,
              geodesic: true,
            }}
          />
        )}
        {convoyMembers.map(m => (
          <ConvoyPin
            key={m.id}
            latitude={m.latitude}
            longitude={m.longitude}
            color={m.color}
            label={m.name?.split(" ")[0]}
          />
        ))}
        {latitude != null && longitude != null && (
          <ConvoyPin
            latitude={latitude}
            longitude={longitude}
            color={OWNER_COLOR}
            label={ownerName?.split(" ")[0]}
            isOwner
          />
        )}
      </GoogleMap>
      <div className="share-mini-map-badge">
        <span className="share-mini-map-badge-dot" aria-hidden="true" />
        {followerCount} watching
      </div>
    </div>
  );
}
