import { Polyline } from "@react-google-maps/api";

const NIGHT_OPTS = { strokeColor: "#6366F1", strokeWeight: 6, strokeOpacity: 0.85, zIndex: 2 };
const LOW_FUEL_OPTS = { strokeColor: "#F59E0B", strokeWeight: 6, strokeOpacity: 0.85, zIndex: 3 };

export default function MapRouteOverlays({ nightSegmentPaths = [], lowFuelSegmentPaths = [] }) {
  return (
    <>
      {nightSegmentPaths.map((path, i) => (
        path?.length > 1 && (
          <Polyline key={`night-${i}`} path={path} options={NIGHT_OPTS} />
        )
      ))}
      {lowFuelSegmentPaths.map((path, i) => (
        path?.length > 1 && (
          <Polyline key={`fuel-${i}`} path={path} options={LOW_FUEL_OPTS} />
        )
      ))}
    </>
  );
}
