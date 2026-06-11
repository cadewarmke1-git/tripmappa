import { Polyline } from "@react-google-maps/api";

/** Brighter stroke for the leg leading to the selected stop. */
export default function HighlightRouteLeg({ path = [] }) {
  if (path.length < 2) return null;
  return (
    <Polyline
      path={path}
      options={{
        strokeColor: "#FFE4A8",
        strokeWeight: 8,
        strokeOpacity: 0.95,
        zIndex: 12,
        geodesic: true,
      }}
    />
  );
}
