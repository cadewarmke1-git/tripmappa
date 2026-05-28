import { Polyline } from "@react-google-maps/api";
import { TRIP_ROUTE_GOLD } from "../../lib/constants.js";

/** Faded dashed gold trail of driven path. */
export default function BreadcrumbPath({ breadcrumbs = [] }) {
  const path = breadcrumbs
    .filter(p => p?.lat != null && p?.lng != null)
    .map(p => ({ lat: p.lat, lng: p.lng }));

  if (path.length < 2) return null;

  return (
    <Polyline
      path={path}
      options={{
        strokeColor: TRIP_ROUTE_GOLD,
        strokeWeight: 3,
        strokeOpacity: 0.35,
        geodesic: true,
        icons: [{
          icon: { path: "M 0,-1 0,1", strokeOpacity: 1, strokeColor: TRIP_ROUTE_GOLD, scale: 3 },
          offset: "0",
          repeat: "14px",
        }],
      }}
    />
  );
}
