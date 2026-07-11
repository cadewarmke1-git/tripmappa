import { Polyline } from "@react-google-maps/api";
import { TRIP_ROUTE_GOLD } from "../../lib/constants.js";

const NIGHT_OPTS = { strokeColor: TRIP_ROUTE_GOLD, strokeWeight: 8, strokeOpacity: 0.35, zIndex: 1 };
const LOW_FUEL_OPTS = { strokeColor: "#F59E0B", strokeWeight: 6, strokeOpacity: 0.85, zIndex: 3 };

function pathOverlayKey(prefix, path) {
  if (!path?.length) return `${prefix}-empty`;
  const start = path[0];
  const end = path[path.length - 1];
  return `${prefix}-${start.lat}-${start.lng}-${end.lat}-${end.lng}-${path.length}`;
}

export default function MapRouteOverlays({
  dayRoutePaths = [],
  activeDayIndex = null,
  nightSegmentPaths = [],
  lowFuelSegmentPaths = [],
}) {
  return (
    <>
      {dayRoutePaths.map(({ dayIndex, path }) => {
        const dimmed = activeDayIndex != null && activeDayIndex !== dayIndex;
        return path?.length > 1 && (
          <Polyline
            key={`day-route-${dayIndex}`}
            path={path}
            options={{
              strokeColor: TRIP_ROUTE_GOLD,
              strokeWeight: dimmed ? 4 : 5,
              strokeOpacity: dimmed ? 0.25 : 0.9,
              zIndex: dimmed ? 2 : 10,
            }}
          />
        );
      })}
      {nightSegmentPaths.map(path => (
        path?.length > 1 && <Polyline key={pathOverlayKey("night", path)} path={path} options={NIGHT_OPTS} />
      ))}
      {lowFuelSegmentPaths.map(path => (
        path?.length > 1 && <Polyline key={pathOverlayKey("fuel", path)} path={path} options={LOW_FUEL_OPTS} />
      ))}
    </>
  );
}
