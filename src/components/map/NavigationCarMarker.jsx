import { useEffect, useMemo, useRef } from "react";
import { Marker } from "@react-google-maps/api";
import {
  applyMarkerRotation,
  buildNavigationCarMarkerIcon,
  computePathHeadingDegrees,
} from "../../lib/navigationCarIcon.js";

export default function NavigationCarMarker({ path = [], visible = false }) {
  const markerRef = useRef(null);
  const position = path?.[0];
  const heading = useMemo(
    () => (visible && path?.length >= 2 ? computePathHeadingDegrees(path) : 0),
    [visible, path],
  );
  const icon = useMemo(
    () => (visible && position ? buildNavigationCarMarkerIcon() : null),
    [visible, position],
  );

  useEffect(() => {
    if (markerRef.current) {
      applyMarkerRotation(markerRef.current, heading);
    }
  }, [heading, icon]);

  if (!visible || !position || !icon) return null;

  return (
    <Marker
      position={{ lat: position.lat, lng: position.lng }}
      icon={icon}
      zIndex={999}
      onLoad={marker => {
        markerRef.current = marker;
        applyMarkerRotation(marker, heading);
      }}
    />
  );
}
