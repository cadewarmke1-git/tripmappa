import { useEffect, useRef } from "react";
import { TRIP_ROUTE_GOLD } from "../../lib/constants.js";

/** Animated gold pulse traveling along the route while AI generates a trip. */
export default function MapGenerationPulse({ mapRef, routePoints = [], active }) {
  const pulseRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    if (!active || !mapRef?.current || !window.google || routePoints.length < 2) {
      if (pulseRef.current) {
        pulseRef.current.setMap(null);
        pulseRef.current = null;
      }
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      return undefined;
    }

    const path = routePoints.map(p => ({ lat: p.lat, lng: p.lng }));
    const line = new window.google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: TRIP_ROUTE_GOLD,
      strokeOpacity: 0.35,
      strokeWeight: 6,
      map: mapRef.current,
      zIndex: 20,
    });

    const pulse = new window.google.maps.Polyline({
      path,
      geodesic: true,
      strokeOpacity: 0,
      strokeWeight: 0,
      map: mapRef.current,
      zIndex: 21,
      icons: [{
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: TRIP_ROUTE_GOLD,
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
        offset: "0%",
      }],
    });
    pulseRef.current = pulse;

    let start = null;
    const duration = 2800;

    function tick(ts) {
      if (!start) start = ts;
      const t = ((ts - start) % duration) / duration;
      const icons = pulse.get("icons");
      if (icons?.length) {
        pulse.set("icons", [{ ...icons[0], offset: `${(t * 100).toFixed(1)}%` }]);
      }
      animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);

    return () => {
      line.setMap(null);
      pulse.setMap(null);
      pulseRef.current = null;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = null;
    };
  }, [active, mapRef, routePoints]);

  return null;
}
