import { useMemo } from "react";
import { Marker } from "@react-google-maps/api";
import { buildNavigationCarMarkerIcon, computePathHeadingDegrees } from "../../lib/navigationCarIcon.js";

export default function NavigationCarMarker({ path = [], visible = false }) {
  const position = path?.[0];
  const icon = useMemo(() => {
    if (!visible || !position) return null;
    const heading = computePathHeadingDegrees(path);
    return buildNavigationCarMarkerIcon(heading);
  }, [visible, position, path]);

  if (!visible || !position || !icon) return null;

  return (
    <Marker
      position={{ lat: position.lat, lng: position.lng }}
      icon={icon}
      zIndex={999}
    />
  );
}
